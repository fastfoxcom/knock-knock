const axios = require('axios');
const config = require('config');

const baseURLs = require('src/utils/api/baseURLs');
const logger = require('src/utils/logger');

axios.interceptors.response.use(response => response, (error) => {
  logger.log(error);
  logger.error(JSON.stringify(error.config));
  if (error.response) {
    logger.error(`Axios Error from upstream - ${JSON.stringify(error.response.data)} - ${error.response.status}`);
  } else if (error.request) {
    logger.error(`Axios Error No response from upstream - ${error.code}`);
  } else {
    logger.error(`Axios Error - ${error.message}`);
  }
  return Promise.reject(error);
});

const getBaseURL = ({ url, baseURL }) => {
  if (baseURL) {
    return baseURL;
  }

  const baseUrlFromUrl = baseURLs.find(baseUrlObj => url.match(baseUrlObj.regex));

  if (baseUrlFromUrl) {
    return baseUrlFromUrl.baseURL;
  }

  return null;
};

const apiRequest = async ({
  method, url, baseURL, headers = {}, params, data,
}) => {
  return axios.request({
    method,
    url,
    baseURL: getBaseURL({ url, baseURL }),
    headers,
    params,
    data,
    timeout: config.get('axiosTimeout'),
  });
};

const request = {
  get: async ({
    url, baseURL, headers, params
  }) => apiRequest({
    method: 'get',
    url,
    baseURL,
    headers,
    params,
  }),

  post: async ({
    url, baseURL, headers, params, data,
  }) => apiRequest({
    method: 'post',
    url,
    baseURL,
    headers,
    params,
    data,
  }),

  put: async ({
    url, baseURL, headers, params, data,
  }) => apiRequest({
    method: 'put',
    url,
    baseURL,
    headers,
    params,
    data,
  }),

  patch: async ({
    url, baseURL, headers, params, data,
  }) => apiRequest({
    method: 'patch',
    url,
    baseURL,
    headers,
    params,
    data,
  }),

  del: async ({
    url, baseURL, headers, params, data,
  }) => apiRequest({
    method: 'delete',
    url,
    baseURL,
    headers,
    params,
    data,
  }),
};

module.exports = request;
