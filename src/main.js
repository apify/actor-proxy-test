const Apify = require('apify');
const uuidv1 = require('uuid/v1');
const _ = require('underscore');
const EventEmitter = require('events');
const { renderResult } = require('./result_renderer');
const { runPlainHttpTest, browserTest } = require('./test_runner');
const { startWebServer } = require('./web_server');
const { REFRESH_INTERVAL_SECS, NO_PROXY } = require('./consts');

const {
    APIFY_CONTAINER_PORT,
    APIFY_CONTAINER_URL,
    APIFY_MEMORY_MBYTES,
} = process.env;

Apify.main(async () => {
    const input = await Apify.getValue('INPUT');
    const { testUrls, plainHttpRequest } = input;
    const { useApifyProxy, apifyProxyGroups, proxyUrls, timeoutSecs } = input.proxy;
    const testFunction = plainHttpRequest ? runPlainHttpTest : browserTest;
    const resultsEmitter = new EventEmitter();
    const results = [];

    // Starts a live view web server.
    startWebServer(APIFY_CONTAINER_PORT, APIFY_CONTAINER_URL, resultsEmitter);

    // Create a map of all proxy URLs to test [proxy URL => title].
    // Here we parse also proxy groups to final Apify proxy URLs.
    const safeProxyUrls = {};
    if (proxyUrls) {
        proxyUrls.forEach((proxyUrl) => {
            safeProxyUrls[proxyUrl] = `Proxy URL ${proxyUrl}`;
        });
    } else if (useApifyProxy) {
        if (!apifyProxyGroups || !apifyProxyGroups.length) {
            safeProxyUrls[Apify.getApifyProxyUrl()] = 'Apify proxy (auto)';
        } else {
            apifyProxyGroups.forEach((group) => {
                const proxyUrl = Apify.getApifyProxyUrl({ groups: [group] });
                safeProxyUrls[proxyUrl] = `Apify proxy (${group})`;
            });
        }
    } else {
        safeProxyUrls[NO_PROXY] = 'No proxy'; // eslint-disable-line
    }

    // Create a request list from pairs proxy URL + test URL.
    // Proxy URL is stored in request.userData.proxyUrl.
    const sources = [];
    _.mapObject(safeProxyUrls, (proxyTitle, proxyUrl) => {
        testUrls.forEach((request) => {
            const userData = { proxyTitle, proxyUrl };
            const uniqueKey = uuidv1();
            sources.push(Object.assign({}, request, { userData, uniqueKey, headers: {} }));
        });
    });

    // Scrape request list using BasicCrawler to have a full controll over browsers.
    const requestList = new Apify.RequestList({ sources });
    await requestList.initialize();
    const crawler = new Apify.BasicCrawler({
        requestList,
        handleRequestFunction: async ({ request }) => {
            const result = await testFunction(request, { timeoutSecs });
            results.push(result);
            resultsEmitter.emit('results', results, true);
        },
        minConcurrency: APIFY_MEMORY_MBYTES ? Math.round(APIFY_MEMORY_MBYTES / 1024) : 1,
    });
    await crawler.run();
    resultsEmitter.emit('results', results, false);

    // Wait for a clients to refresh page.
    await Apify.utils.sleep(REFRESH_INTERVAL_SECS * 1000 * 3);

    // Render result HTML and save it to key-value store.
    const html = renderResult(results);
    await Apify.setValue('OUTPUT', html, { contentType: 'text/html; charset=utf-8' });
});
