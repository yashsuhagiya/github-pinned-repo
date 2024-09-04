import { load } from "cheerio";

const BASE_GITHUB_URL = "https://github.com";

interface RepoData {
  name: string;
  repo: string;
  description: string;
  language: {
    name: string;
    color: string;
  };
  stars: number;
  forks: number;
}

const getPinnedRepos = async (username: string): Promise<RepoData[] | null> => {
  let request: Response;
  try {
    request = await fetch(`${BASE_GITHUB_URL}/${username}`);
  } catch {
    return null;
  }

  const html = await request.text();

  // Create cheerio object with HTML
  const $ = load(html);

  const pinned_repos: RepoData[] = [];

  try {
    // Loop through each pinned repository in the item list
    $(".js-pinned-item-list-item").each((i, el) => {
      const repoData: RepoData = {
        name: $(el).find("a").get(0)?.attribs.href.split("/")[2] || "",
        repo: BASE_GITHUB_URL + ($(el).find("a").get(0)?.attribs.href || ""),
        description: $(el)
          .find("p.pinned-item-desc")
          .text()
          .replace(/\n/g, "")
          .trim(),
        language: {
          name: $(el).find("span[itemprop='programmingLanguage']").text(),
          color:
            $(el)
              .find("span.repo-language-color")
              .get(0)
              ?.attribs.style.split(":")[1]
              .replace(";", "")
              .trim() || "",
        },
        stars:
          parseInt(
            $(el).find("a[href$='stargazers']").text().replace(",", "").trim()
          ) || 0,
        forks:
          parseInt(
            $(el)
              .find("a[href$='network/members']")
              .text()
              .replace(",", "")
              .trim()
          ) || 0,
      };

      // Add repository data to pinned_repos array
      pinned_repos.push(repoData);
    });
  } catch {
    return null;
  }

  return pinned_repos;
};

export default getPinnedRepos;
