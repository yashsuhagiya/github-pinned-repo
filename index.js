// index.js or app.js

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

const getPinnedRepo = require("./utils/getPinnedRepo");

app.use(express.static('public')); // Create a 'public' folder for your HTML, CSS, JS files

// Home page
app.get('/', (req, res) => {
    res.send({
        message: 'Welcome to the GitHub Pinned Repo page! To get the pinned repos of a user, go to /username. For example: /yashsuhagiya'
    });
});

// Route to handle the username-specific API
app.get('/:username', async (req, res) => {
    const username = req.params.username;
    const pinnedRepos = await getPinnedRepo(username);
    res.send(pinnedRepos);
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
