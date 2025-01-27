const cheerio = require("cheerio")

const BASE_GITHUB_URL = 'https://github.com';

const getPinnedRepos = async (username) => {
    let request
    try {
        request = await fetch(BASE_GITHUB_URL + "/" + username)
    } catch {
        return null
    }

    const html = await request.text()

    // create cheerio object with HTML
    const $ = cheerio.load(html)

    let pinned_repos = []

    try {
        // loop through each pinned repository in the item list
        $(".js-pinned-item-list-item").each((i, el) => {

            let repo_data = {
                "name": $(el).find("a").get(0)?.attribs.href.split("/")[2] || "",
                "repo": BASE_GITHUB_URL + $(el).find("a").get(0)?.attribs.href || "",
                "description": $(el).find("p.pinned-item-desc").text().replace(/\n/g, "").trim(),
                "language": {
                    "name": $(el).find("span[itemprop='programmingLanguage']").text(),
                    "color": $(el).find("span.repo-language-color").get(0)?.attribs.style.split(":")[1].replace(";", "").trim() || ""
                },
                "stars": parseInt($(el).find("a[href$='stargazers']").text().replace(",", "").trim()) || 0,
                "forks": parseInt($(el).find("a[href$='network/members']").text().replace(",", "").trim()) || 0,
            }

            // add repository data to pinned_repos arrays
            pinned_repos.push(repo_data)
        });
    } catch {
        return null
    }

    return pinned_repos
};

module.exports = getPinnedRepos;