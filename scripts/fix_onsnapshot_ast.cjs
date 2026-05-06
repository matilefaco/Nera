const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');

const project = new Project();
project.addSourceFilesAtPaths("src/**/*.{ts,tsx}");

for (const sourceFile of project.getSourceFiles()) {
    let changed = false;
    
    let callExprs = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    // filter to only onSnapshot
    callExprs = callExprs.filter(c => c.getExpression().getText() === "onSnapshot" || c.getExpression().getText().endsWith(".onSnapshot"));
    
    // Reverse order to avoid AST node forgotten errors when modifying parents before children
    for (const callExpr of callExprs.reverse()) {
        try {
            const args = callExpr.getArguments();
            
            // onSnapshot(query/doc, callback, ?errorCallback)
            if (args.length === 2 && args[1].getKind() === SyntaxKind.ArrowFunction) {
                callExpr.addArgument(`(error) => { console.error("Firestore onSnapshot error:", error); }`);
                changed = true;
            } else if (args.length === 3 && args[1].getText() !== "options" && args[1].getKind() !== SyntaxKind.ArrowFunction && args[2].getKind() === SyntaxKind.ArrowFunction) {
                callExpr.addArgument(`(error) => { console.error("Firestore onSnapshot error:", error); }`);
                changed = true;
            }
            
            // Refetch arguments after modifying
            const newArgs = callExpr.getArguments();
            const callbackArg = newArgs.find(a => a.getKind() === SyntaxKind.ArrowFunction);
            if (callbackArg) {
               const body = callbackArg.getBody();
               if (body.getKind() === SyntaxKind.Block) {
                   const text = body.getText();
                   if (!text.includes("try {")) {
                      const innerStatements = body.getStatements().map(s => s.getText()).join("\\n");
                      body.replaceWithText(`{
  try {
    ${innerStatements}
  } catch (err) {
    console.error("Error in onSnapshot callback:", err);
  }
}`);
                      changed = true;
                   }
               }
            }
        } catch (e) {
            console.error("Error modifying node in", sourceFile.getFilePath(), e.message);
        }
    }
    
    if (changed) {
        sourceFile.saveSync();
        console.log("Updated", sourceFile.getFilePath());
    }
}
