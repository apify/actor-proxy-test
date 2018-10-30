const Apify = require('apify');
const rp = require('request-promise');
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
 * Tests given URL with given proxy using a plain HTTP request and returns result.
 *
 * @param  {Object} request
 * @param  {Object} opts
 * @param  {Number} opts.timeoutSecs
 * @return {Promise}
 */
exports.runPlainHttpTest = async (request, { timeoutSecs }) => {
    const htmlStoreKey = uuidv1();
    const { proxyUrl, proxyTitle } = request.userData;

    console.log(`- testing ${request.url} with proxy URL ${proxyUrl}`);

    const startedAt = Date.now();

    try {
        const response = await rp({
            url: request.url,
            method: request.method,
            headers: request.headers,
            proxy: proxyUrl,
            resolveWithFullResponse: true,
            timeout: timeoutSecs * 1000,
        });

        await Apify.setValue(htmlStoreKey, response.body, { contentType: 'text/html; charset=utf-8' });

        return {
            url: request.url,
            htmlStoreKey,
            statusCode: response.statusCode,
            contentType: response.headers.contentType,
            durationSecs: (Date.now() - startedAt) / 1000,
            proxyTitle,
        };
    } catch (error) {
        return {
            error,
            url: request.url,
            proxyTitle,
        };
    }
};

/**
 * Tests given URL with given proxy using a real browser and returns result.
 *
 * @param  {Object} request
 * @param  {Object} opts
 * @param  {Number} opts.timeoutSecs
 * @return {Promise}
 */
exports.browserTest = async (request, { timeoutSecs }) => {
    const htmlStoreKey = uuidv1();
    const { proxyUrl, proxyTitle } = request.userData;

    console.log(`- testing ${request.url} with proxy URL ${proxyUrl}`);

    try {
        const browser = await Apify.launchPuppeteer({ proxyUrl });
        const page = await browser.newPage();
        const startedAt = Date.now();
        const response = await page.goto(request.url, { timeout: timeoutSecs * 1000 });
        const screenshot = await getScreenshot(page);
        const html = await page.$eval('html', (el) => el.outerHTML);
        await Apify.setValue(htmlStoreKey, html, { contentType: 'text/html; charset=utf-8' });
        const data = {
            url: request.url,
            htmlStoreKey,
            statusCode: response.status(),
            contentType: response.headers().contentType,
            durationSecs: (Date.now() - startedAt) / 1000,
            screenshot,
            proxyTitle,
        };

        await page.close();
        await browser.close();

        return data;
    } catch (error) {
        return {
            error,
            url: request.url,
            proxyTitle,
        };
    }
};
