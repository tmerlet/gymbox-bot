const request = require('request');
const { flatten } = require('ramda');
const { log } = require('./utils/logger');

const baseUrl = 'https://gymbox.legendonlineservices.co.uk/enterprise';
const loginUrl = `${baseUrl}/account/login`;
const timeTableUrl = `${baseUrl}/BookingsCentre/MemberTimetable`;
const bookClassUrl = `${baseUrl}/BookingsCentre/AddBooking`;
const activeNotices = `${baseUrl}/notices/activenotices`;
const getClubsUrl = `${baseUrl}/mobile/getfacilities`;

const completeBasketUrl = `${baseUrl}/Basket/Pay`;
const confirmUrl = `${baseUrl}/basket/paymentconfirmed`;
const logoutUrl = `${baseUrl}/Account/Logout`;

let cookies = {};
const interestingCookies = [
  'ASP.NET_SessionId',
  'LegendOnlineAffinity',
  'Responsive',
  'APP_LGD_COOKIE_TEST'
];
const getCookies = notFormattedCookies => {
  let tmp = notFormattedCookies
    .map(c => c.split(';'))
    .map(c =>
      c.filter(nestedC => !!interestingCookies.find(i => nestedC.includes(i)))
    );

  tmp = flatten(tmp).concat('APP_LGD_COOKIE_TEST=true');

  return tmp.join('; ');
};

module.exports = {
  login({ email, password, shouldSetCookies }) {
    return new Promise((res, rej) => {
      request.post(
        {
          url: loginUrl,
          headers: {
            Cookie: shouldSetCookies ? undefined : cookies,
            'Accept-Language': 'en-GB,en;q=0.9,es;q=0.8',
            DNT: '1'
          },
          formData:
            email && password
              ? {
                  'login.Email': email,
                  'login.Password': password
                }
              : undefined
        },
        (err, _, body) => {
          if (shouldSetCookies) {
            cookies = getCookies(_.headers['set-cookie']);
            return res();
          }
          if (
            !err &&
            (_.statusCode === 302 || _.statusCode === 200) &&
            !body.includes('Login failed')
          ) {
            log('Login succeed code: ', _.statusCode);

            return res();
          }

          log(`Couldn't login status: ${_.statusCode}`);
          return rej(
            body.includes('Login failed') ? new Error('Login failed') : err
          );
        }
      );
    });
  },
  logout() {
    return new Promise((res, rej) => {
      request.post(
        {
          url: logoutUrl,
          headers: {
            Cookie: cookies
          }
        },
        (err, _, body) => {
          if (!err && _.statusCode === 302) {
            log('Logout succeed code: ', _.statusCode);
            return res();
          }

          return rej(err);
        }
      );
    });
  },
  getAllClubs() {
    return new Promise((res, rej) => {
      request.get(
        {
          url: getClubsUrl,
          headers: {
            Cookie: cookies
          }
        },
        (err, _, body) => {
          if (!err) {
            log('Fetched bookable clubs');
            return res(body);
          }
          return rej(err);
        }
      );
    });
  },
  getGymboxTimeTableById(id) {
    return new Promise((res, rej) => {
      request.get(
        {
          url: `${timeTableUrl}?clubId=${id}`,
          headers: {
            Cookie: cookies
          }
        },
        (err, _, body) => {
          if (!err) {
            log(`Fetched time table for club Id ${id}`);
            return res(body);
          }

          return rej(err);
        }
      );
    });
  },
  getGymboxTimeTable() {
    return new Promise((res, rej) => {
      request.get(
        {
          url: timeTableUrl,
          headers: {
            Cookie: cookies
          }
        },
        (err, _, body) => {
          if (!err) {
            log('Fetched time table');
            return res(body);
          }

          return rej(err);
        }
      );
    });
  },
  postBooking(lesson) {
    const params = [['booking', lesson.id], ['ajax', Math.random()]];

    return new Promise((res, rej) => {
      request.get(
        {
          url: `${bookClassUrl}?${params.map(el => el.join('=')).join('&')}`,
          headers: {
            Cookie: cookies
          }
        },
        (err, _, body) => {
          const parsedBody = JSON.parse(body);
          if (!err && parsedBody.Success) {
            log(`Class ${lesson.className} at ${lesson.time} added to basket`);
            return res(body);
          }

          return rej(err || body);
        }
      );
    });
  },
  getActiveNotices(Referer) {
    return new Promise((res, rej) => {
      request.get(
        {
          url: activeNotices,
          headers: {
            Cookie: cookies,
            Referer
          }
        },
        (err, _, body) => {
          const parsedBody = JSON.parse(body);
          if (!err) {
            log(`Active notices status code: ${_.statusCode}`);
            return res(body);
          }

          log(`Active notice failed with code: ${_.statusCode}`);
          return rej(err || body);
        }
      );
    });
  },
  completeBasket() {
    return new Promise((res, rej) => {
      request.get(
        {
          url: completeBasketUrl,
          headers: {
            Cookie: cookies,
            Referer:
              'https://gymbox.legendonlineservices.co.uk/enterprise/Basket/',
            'Upgrade-Insecure-Requests': '1',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            Host: 'gymbox.legendonlineservices.co.uk',
            Pragma: 'no-cache',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'Accept-Encoding': 'gzip, deflate, sdch, br',
            'Accept-Language': 'en,fr-FR;q=0.8,fr;q=0.6,en-US;q=0.4',
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
          }
        },
        (err, _, body) => {
          if ((!err && _.statusCode === 200) || _.statusCode === 302) {
            log(`Payment succeed with status code: ${_.statusCode}`);
            return res();
          }

          delete _.body;
          log(JSON.stringify(_));
          log(`Payment rejected with status code: ${_.statusCode}, req: ${_}`);
          return rej(err);
        }
      );
    });
  },
  confirmPayment() {
    return new Promise((res, rej) => {
      request.get(
        {
          url: confirmUrl,
          headers: {
            Cookie: cookies
          }
        },
        (err, _, body) => {
          if (!err && _.statusCode === 200) {
            log(`Payment confirmed with status code: ${_.statusCode}`);
            return res();
          }

          log(
            `Payment confirmation rejected with status code: ${_.statusCode}`
          );
          return rej(err);
        }
      );
    });
  }
};
