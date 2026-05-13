const fs = require('fs');
fetch('http://localhost:3000/login').then(r => r.text()).then(login => {
  fetch('http://localhost:3000/p/jajajsje').then(r => r.text()).then(profile => {
    fs.writeFileSync('login.html', login);
    fs.writeFileSync('profile.html', profile);
  });
});
