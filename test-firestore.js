import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app);

async function test() {
  try {
    await setDoc(doc(db, "public_test", "test"), {
      notes: "test without auth"
    });
    console.log("SUCCESS IF TRUE");
  } catch (e) {
    console.log("ERROR IF TRUE", e.code, e.message);
  }
  process.exit();
}
test();
