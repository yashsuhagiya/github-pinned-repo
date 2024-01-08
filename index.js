// index.js or app.js

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const path = require("path");

const getPinnedRepo = require("./utils/getPinnedRepo");

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(express.static(path.join(__dirname, "./public")));

// Home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/public/index.html'));
});

// Route to handle the username-specific API
app.get('/:username', async (req, res) => {
    const username = req.params.username;
    const pinnedRepos = await getPinnedRepo(username);
    res.json({
        data: pinnedRepos
    });
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
