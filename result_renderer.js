const { APIFY_DEFAULT_KEY_VALUE_STORE_ID } = process.env;

/**
 * Renders result of test URL.
 *
 * @param  {Object} options
 * @return {String}
 */
const renderUrlResult = ({ url, htmlStoreKey, statusCode, contentType, durationSecs, screenshot, error }) => {
    if (error) return `<h3>${url}</h3><p>Error: ${error}</p>`;

    let screenshotHtml;

    if (screenshot.error) {
        screenshotHtml = `Screenshot error: ${screenshot.error}`;
    } else if (screenshot.buffer) {
        screenshotHtml = `
<a href="https://api.apify.com/v2/key-value-stores/${APIFY_DEFAULT_KEY_VALUE_STORE_ID}/${screenshot.storeKey}">
    <img src="data:image/jpeg;base64,${screenshot.buffer.toString('base64')}" width="300" />
</a>`;
    }

    return `<h5>${url}</h5>
<ul>
    <li>Status code: ${statusCode}</li>
    <li>Content type: ${contentType}</li>
    <li>Load time: ${durationSecs}secs</li>
    <li>Html:
        <a href="https://api.apify.com/v2/key-value-stores/${APIFY_DEFAULT_KEY_VALUE_STORE_ID}/${htmlStoreKey}" target="_blank">
            View
        </a>
    </li>
</ul>
${screenshotHtml}
`;
};

/**
 * Renders result of one proxyUrl / apifyProxyGroup.
 *
 * @param  {Object} options
 * @param  {String} options.uses
 * @param  {Array}  options.data
 * @return {String}
 */
const renderTestResult = ({ uses, data }) => {
    return `<tr>
    <td colspan="${data.length}"><h2>${uses}</h2></td>
</tr>
<tr>
    <td>${data.map(renderUrlResult).join('</td><td>')}</td>
</tr>`;
};

/**
 * Renders whole HTML results page.
 *
 * @param  {Object} options
 * @param  {Object} options.input
 * @param  {Object} options.results
 * @return {String}
 */
exports.renderResult = ({ input, results }) => {
    const { plainHttpRequest } = input;
    const { useApifyProxy, apifyProxyGroups, proxyUrls } = input.proxy;

    return `<html>
    <head>
        <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.1.3/css/bootstrap.min.css" />
        <style>
            table td { vertical-align: top; padding: 10px; }
        </style>
    </head>
    <body>
        <h1>Test results</h1>
        <ul>
            ${!useApifyProxy && (!proxyUrls || !proxyUrls.length) ? '<li>Not using any proxy</li>' : ''}
            ${proxyUrls && proxyUrls.length ? '<li>Testing custom list of proxy URLs</li>' : ''}
            ${useApifyProxy && (!apifyProxyGroups || !apifyProxyGroups.length) ? '<li>Testing using Apify proxy in auto mode</li>' : ''}
            ${useApifyProxy && apifyProxyGroups && apifyProxyGroups.length ? '<li>Testing list of Apify proxy groups</li>' : ''}
            ${plainHttpRequest ? '<li>Using plain HTTP request (not browser)</li>' : '<li>Using full browser</li>'}
        </ul>
        <hr />
        <table>
            ${results.map(renderTestResult).join('\n')}
        </table>
    </body>
</html>`;
};
