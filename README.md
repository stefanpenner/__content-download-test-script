## Usage

**Supported options:**

| Flag    | Value       | Description                                                                                         |
|---------|-------------|-----------------------------------------------------------------------------------------------------|
| COUNT   | integer > 0 | The number of samples to take                                                                       |
| URL     | string      | The url you want to test                                                                            |
| COOKIE  | string      | Your cookie                                                                                         |
| DEV_ENV | boolean     | Set this flag to `true` if you are in dev environment and want to ignore certificate related issues   |
| HTTP_V1 | boolean     | toggle between http v1 and v2 (v2 default)                                                          |

```sh
brew install r
yarn install

COUNT=10 COOKIE=(your cookie) URL='http://localhost:4200/home/' DEV_ENV=true yarn start
```
