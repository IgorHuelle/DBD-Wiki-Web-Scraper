const fs = require('fs');
const { JSDOM } = require('jsdom');
const axios = require("axios").default;

const BASE_LINK = "https://deadbydaylight.wiki.gg";

// UTIL FUNCTIONS
function getImageUrl(elm) {
    const elmClone = elm.cloneNode(true);

    const elmImage = elmClone.querySelector("img");
    const imageSrc = elmImage?.src;
    const perkImgUrl = imageSrc?.substring(0, imageSrc.lastIndexOf("/")).replace("/thumb", "");
    const perkName = elmImage?.alt;

    return { perkImgUrl, perkName };
}
function getDescription(elm) {
    const elmClone = elm.cloneNode(true);

    const icons = elmClone.querySelectorAll(".iconLink");
    icons.forEach((icon) => icon.remove());

    const links = elmClone.querySelectorAll('a');
    links.forEach((link) => {
        link.classList.add('link');
        if (link.href) {
            link.href = BASE_LINK + link.getAttribute('href');
            link.setAttribute("target", "_blank")
        }
    });

    return encodeURI(elmClone.innerHTML);
}
function getCharacter(elm) {
    const elmClone = elm.cloneNode(true);

    const charName = elmClone.querySelector("a")?.title || "Bloodweb";
    const charImg = elmClone.querySelector("img")?.src;

    return { charName, charImg };
}

// ASYNCS
async function getScrapeFromUrl(url) {
    const stuff = await axios.get(url);
    const dom = new JSDOM(stuff.data);
    const { document } = dom.window;

    return document;
}
async function parseCharacters() {
    const scrapes = {
        killers: await getScrapeFromUrl("https://deadbydaylight.wiki.gg/wiki/Killers"),
        survivors: await getScrapeFromUrl("https://deadbydaylight.wiki.gg/wiki/Survivors")
    }

    const characters = { killers: {}, survivors: {} }


    Object.entries(scrapes).forEach(([type, doc]) => {
        const portraits = [...doc.querySelector('div[style*="color: #fff;"]').children];

        for (const portrait of portraits) {

            const charImgUrl = portrait.querySelector("img")?.src;
            const fullName = portrait.querySelector(".charPortraitImage a")?.title
            // if (!charImgUrl || !fullName) { console.log("[x] - Portrait missing url or name"); continue }
            const charName = type === "killers" ? (fullName).replace(/^The\s+/, '') : fullName; // 'The '...

            characters[type][charName] = {
                portrait: BASE_LINK + charImgUrl
            }
        }
    });

    return characters;
}
async function parsePerks() {
    const scrapes = {
        killers: await getScrapeFromUrl("https://deadbydaylight.wiki.gg/wiki/Killer_Perks"),
        survivors: await getScrapeFromUrl("https://deadbydaylight.wiki.gg/wiki/Survivor_Perks")
    }

    const perks = { killers: {}, survivors: {} }

    Object.entries(scrapes).forEach(([type, doc]) => {
        const rows = [...doc.querySelector('tbody').children];

        // 0 - Icon
        // 1 - Name
        // 2 - Description
        // 3 - Portrait

        for (const row of rows) {

            const { perkImgUrl, perkName } = getImageUrl(row.children[0]);
            const { charName, charImg } = getCharacter(row.children[3]);
            const perkDesc = getDescription(row.children[2]);

            if (!perkName) continue;

            perks[type][perkName] = {
                icon: BASE_LINK + perkImgUrl,
                description: perkDesc,
                obtainment: charName,
            }
        }
    });

    return perks;
}
async function parseWikiData() {
    const characters = await parseCharacters();
    const perks = await parsePerks();
    return { characters, perks };
}

async function init() {
    console.log("Downloading data...");

    const data = await parseWikiData();

    const jsonStruct = {
        perks: {
            killers: data["perks"]["killers"],
            survivors: data["perks"]["survivors"]
        },
        characters: {
            killers: data["characters"]["killers"],
            survivors: {
                "Solo Survivor": {
                    portrait: "assets/images/survivor_portraits/S01_Solo_Portrait.webp"
                },
                "Solo Advanced": {
                    portrait: "assets/images/survivor_portraits/S02_SoloAdvanced_Portrait.webp"
                },
                "Team Player": {
                    portrait: "assets/images/survivor_portraits/S03_Team_Portrait.webp"
                },
            }
        },
        other: {
            updateDateUNIX: Math.floor(Date.now() / 1000), // to return UNIX
            universalKiller: {
                portrait: "assets/images/Unknown_Character.webp"
            },
            allSurvivors: data["characters"]["survivors"]
        }
    }

    const jsonName = "wiki_scrape.json";
    fs.writeFileSync(jsonName, JSON.stringify(jsonStruct, null, '\t'));
    console.log(`DATA SAVED: Exported to ${jsonName}`);
};
init().catch(console.error);