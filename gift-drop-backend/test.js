require('express')().get('/api/test', (req, res) => {
    res.json({ works: true });
  }).listen(3000);