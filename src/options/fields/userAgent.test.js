import userAgent from './userAgent';
import { inferUserAgent } from '../../infer';

jest.mock('./../../infer/inferUserAgent');

inferUserAgent.mockImplementation(() => Promise.resolve());

test('when a userAgent parameter is passed', () => {
  expect(inferUserAgent).toHaveBeenCalledTimes(0);

  const params = { userAgent: 'valid user agent' };
  return userAgent(params).then((result) => {
    expect(result).toBe(params.userAgent);
  });
});

test('no userAgent parameter is passed', () => {
  const params = { electronVersion: '123', platform: 'mac' };
  return userAgent(params).then((result) => {
    expect(inferUserAgent).toHaveBeenCalledWith(params.electronVersion, params.platform);
  });
});

