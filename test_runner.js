const Apify = require('apify');
const rp = require('request-promise');
const Promise = require('bluebird');
const uuidv1 = require('uuid/v1');

/**
 * Takes a screenshot. In a case of an error, catches it and returns error in result object.
 *
 * @param  {Object} page
 * @return {Promise}
 */
const getScreenshot = async (page) => {
    const storeKey = uuidv1();
    let buffer;
    let error;

    try {
        buffer = await page.screenshot({ type: 'jpeg', quality: 50 });
        await Apify.setValue(storeKey, buffer, { contentType: 'image/jpeg' });
    } catch (err) {
        error = err;
    }

    return { storeKey, error, buffer };
};

/**
 * Tests given set of URLs with given proxy using a plain HTTP request and returns result.
 *
 * @param  {String} proxyUrl
 * @param  {Array}  testUrls
 * @return {Promise}
 */
exports.runPlainHttpTest = async ({ proxyUrl, testUrls }) => {
    const htmlStoreKey = uuidv1();

    return Promise.mapSeries(testUrls, async (testUrl) => {
        console.log(`- testing ${testUrl.url}`);

        const startedAt = Date.now();

        try {
            const response = await rp({
                url: testUrl.url,
                method: testUrl.method,
                headers: testUrl.headers,
                proxy: proxyUrl,
                resolveWithFullResponse: true,
            });

            await Apify.setValue(htmlStoreKey, response.body, { contentType: 'text/html; charset=utf-8' });

            return {
                url: testUrl.url,
                htmlStoreKey,
                statusCode: response.statusCode,
                contentType: response.headers.contentType,
                durationSecs: (Date.now() - startedAt) / 1000,
            };
        } catch (error) {
            return {
                error,
                url: testUrl.url,
            };
        }
    });
};

/**
 * Tests given set of URLs with given proxy using a real browser and returns result.
 *
 * @param  {String} proxyUrl
 * @param  {Array}  testUrls
 * @return {Promise}
 */
exports.browserTest = async ({ proxyUrl, testUrls }) => {
    const htmlStoreKey = uuidv1();

    return Promise.mapSeries(testUrls, async (testUrl) => {
        console.log(`\n- testing ${testUrl.url}`);

        try {
            const browser = await Apify.launchPuppeteer({ proxyUrl });
            const page = await browser.newPage();
            const startedAt = Date.now();
            const response = await page.goto(testUrl.url);
            const screenshot = await getScreenshot(page);
            const html = await page.$eval('html', (el) => el.outerHTML);
            await Apify.setValue(htmlStoreKey, html, { contentType: 'text/html; charset=utf-8' });
            const data = {
                url: testUrl.url,
                htmlStoreKey,
                statusCode: response.status(),
                contentType: response.headers().contentType,
                durationSecs: (Date.now() - startedAt) / 1000,
                screenshot,
            };

            await page.close();
            await browser.close();

            return data;
        } catch (error) {
            return {
                error,
                url: testUrl.url,
            };
        }
    });
};
