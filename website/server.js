const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files (JS, CSS, images, etc.) from the website directory
app.use(express.static(__dirname));

// Route for the home page
app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Route for object pages (only allow xbox and mouse)
app.get('/:object_name', (req, res) => {
  const objectName = req.params.object_name.toLowerCase();
  if (objectName === 'xbox' || objectName === 'mouse') {
    // Pass the object name as a query parameter for the frontend
    res.sendFile(path.join(__dirname, 'app.html'));
  } else {
    res.redirect('/home');
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
}); 