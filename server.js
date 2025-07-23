const express = require('express');
const path = require('path');
const app = express();
const port = 5500;

app.use(express.static(path.join(__dirname, 'website')));

app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'website', 'index.html'));
});

// app.get('/:page', (req, res) => {
//   const filePath = path.join(__dirname, 'website', `${req.params.page}.html`);
//   res.sendFile(filePath, (err) => {
//     if (err) {
//       res.sendFile(path.join(__dirname, 'website', 'index.html'))
//     }
//   });
// });

app.get(['/xbox', '/mouse', '/uploaded'], (req, res) => {
  res.sendFile(path.join(__dirname, 'website', 'app.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
})