const { Actor } = require('apify');
const log = require('@apify/log').default;
const { launchPuppeteer } = require('crawlee');
const rp = require('request-promise');
const { v1: uuidv1 } = require('uuid');
const { NO_PROXY } = require('./consts');

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
        await Actor.setValue(storeKey, buffer, { contentType: 'image/jpeg' });
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
    const startedAt = Date.now();
    const htmlStoreKey = uuidv1();
    const { proxyUrl, proxyTitle } = request.userData;
    const opts = {
        url: request.url,
        method: request.method,
        headers: request.headers,
        resolveWithFullResponse: true,
        timeout: timeoutSecs * 1000,
    };
    if (proxyUrl !== NO_PROXY) opts.proxy = proxyUrl;

    log.info(`testing ${request.url} with proxy URL ${proxyUrl}`);

    try {
        const response = await rp(opts);

        await Actor.setValue(htmlStoreKey, response.body, { contentType: 'text/html; charset=utf-8' });

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
    const opts = {};

    if (proxyUrl !== NO_PROXY) opts.proxyUrl = proxyUrl;

    log.info(`Testing ${request.url} with proxy URL ${proxyUrl}`);

    try {
        const browser = await launchPuppeteer(opts);
        const page = await browser.newPage();
        const startedAt = Date.now();
        const response = await page.goto(request.url, { timeout: timeoutSecs * 1000 });
        const screenshot = await getScreenshot(page);
        const html = await page.$eval('html', (el) => el.outerHTML);
        await Actor.setValue(htmlStoreKey, html, { contentType: 'text/html; charset=utf-8' });

        const data = {
            url: request.url,
            htmlStoreKey,
            statusCode: response.status(),
            contentType: response.headers()['content-type'],
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
