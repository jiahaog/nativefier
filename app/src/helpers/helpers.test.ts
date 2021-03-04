import { linkIsInternal, getCounterValue } from './helpers';

const internalUrl = 'https://medium.com/';
const internalUrlWww = 'https://www.medium.com/';
const sameBaseDomainUrl = 'https://app.medium.com/';
const internalUrlCoUk = 'https://medium.co.uk/';
const sameBaseDomainUrlCoUk = 'https://app.medium.co.uk/';
const internalUrlSubPath = 'topic/technology';
const externalUrl = 'https://www.wikipedia.org/wiki/Electron';
const wildcardRegex = /.*/;

test('the original url should be internal', () => {
  expect(linkIsInternal(internalUrl, internalUrl, undefined)).toEqual(true);
});

test('sub-paths of the original url should be internal', () => {
  expect(
    linkIsInternal(internalUrl, internalUrl + internalUrlSubPath, undefined),
  ).toEqual(true);
});

test("'about:blank' should be internal", () => {
  expect(linkIsInternal(internalUrl, 'about:blank', undefined)).toEqual(true);
});

test('urls from different sites should not be internal', () => {
  expect(linkIsInternal(internalUrl, externalUrl, undefined)).toEqual(false);
});

test('all urls should be internal with wildcard regex', () => {
  expect(linkIsInternal(internalUrl, externalUrl, wildcardRegex)).toEqual(true);
});

test('a "www." of a domain should be considered internal', () => {
  expect(linkIsInternal(internalUrl, internalUrlWww, undefined)).toEqual(true);
});

test('urls on the same "base domain" should be considered internal', () => {
  expect(linkIsInternal(internalUrl, sameBaseDomainUrl, undefined)).toEqual(
    true,
  );
});

test('urls on the same "base domain" should be considered internal, even with a www', () => {
  expect(linkIsInternal(internalUrlWww, sameBaseDomainUrl, undefined)).toEqual(
    true,
  );
});

test('urls on the same "base domain" should be considered internal, long SLD', () => {
  expect(
    linkIsInternal(internalUrlCoUk, sameBaseDomainUrlCoUk, undefined),
  ).toEqual(true);
});

const smallCounterTitle = 'Inbox (11) - nobody@example.com - Gmail';
const largeCounterTitle = 'Inbox (8,756) - nobody@example.com - Gmail';
const noCounterTitle = 'Inbox - nobody@example.com - Gmail';

test('getCounterValue should return undefined for titles without counter numbers', () => {
  expect(getCounterValue(noCounterTitle)).toEqual(undefined);
});

test('getCounterValue should return a string for small counter numbers in the title', () => {
  expect(getCounterValue(smallCounterTitle)).toEqual('11');
});

test('getCounterValue should return a string for large counter numbers in the title', () => {
  expect(getCounterValue(largeCounterTitle)).toEqual('8,756');
});
