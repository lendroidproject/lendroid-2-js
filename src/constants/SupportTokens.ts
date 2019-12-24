import * as ABIs from './ABIs'

const getAll = (token, info) => ({
  def: ABIs[token],
  base: token,
  ...(typeof info === 'string' ? { all: info } : info),
})

export default (tokens: any = {}) => ({
  ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
  Owner: tokens.Owner || '0x2fcc0f7892538574f05243adD566Eab3922d1eBd',
  LST: getAll('ERC20', tokens.LST || '0xa72d0651c868a85e222eed05028264c86653a7f6'),
  Lend: getAll('ERC20', tokens.Lend || '0xf041c1129470e92aa5483c975e60ff1ef78f69e2'),
  Borrow: getAll('ERC20', tokens.Borrow || '0x48c52951efbcbc7957d9166bb9efb2df47fbcb25'),
  PriceFeed: getAll('PriceFeed', tokens.PriceFeed || '0x9bd26b71935295c4b0ada1f0c5046f61f7432746'),
  CurrencyDao: getAll('CurrencyDao', tokens.CurrencyDao || '0xfb224550e8b54629beec81331eb226b9081236ab'),
  InterestPoolDao: getAll('InterestPoolDao', tokens.InterestPoolDao || '0x14c865a62d176d52640feaa98c9060a64f9ea1b3'),
  UnderwriterPoolDao: getAll(
    'UnderwriterPoolDao',
    tokens.UnderwriterPoolDao || '0x6943ae6cd2bbae64d7588d93119159df6eabbba2'
  ),
  MarketDao: getAll('MarketDao', tokens.MarketDao || '0xe0d5cbfbcb7f233856168b9ec526892bb5deb4fb'),
  ShieldPayoutDao: getAll('ShieldPayoutDao', tokens.ShieldPayoutDao || '0xb271b0c01fac4ca33aa77fc042f3bcbf2b762e32'),
  PoolNameRegistry: getAll('PoolNameRegistry', tokens.PoolNameRegistry || '0xe88c99cb4fa0b3fba49421f26fc61adb996a323a'),
  PositionRegistry: getAll('PositionRegistry', tokens.PositionRegistry || '0xa3ffc0d55b10daeacfa578effea5a61f765f6c0a'),
  CurrencyPool: getAll('CurrencyPool', tokens.CurrencyPool || '0xb3c340ed6ff6c71debb8eeb8990fe88a74626dac'),
  InterestPool: getAll('InterestPool', tokens.InterestPool || '0xf2ac6a4195b604ce4f4a6ac4376134dbdd00d3b0'),
  UnderwriterPool: getAll('UnderwriterPool', tokens.UnderwriterPool || '0x61860c478c2a908d07c147a5a5bcf7e4167a6201'),
  PriceOracle: getAll('PriceOracle', tokens.PriceOracle || '0xb911e70a123fbb3b0acf3389cec9c02178e9fc7d'),
  CollateralAuctionCurve: getAll(
    'CollateralAuctionCurve',
    tokens.CollateralAuctionCurve || '0x4f2cc8c2a133f535c2a8973a87a1464bf7237e39'
  ),
  ERC20: getAll('ERC20', tokens.ERC20 || '0x1b83332c613c386f5490b56546893a37e34b3819'),
  MultiFungibleToken: getAll(
    'MultiFungibleToken',
    tokens.MultiFungibleToken || '0x0c7a111876ececef2e80c8a0dfd75b1603f73f59'
  ),
  ProtocolDao: getAll('ProtocolDao', tokens.ProtocolDao || '0xf79179ea141270a3a2ffe553b6993d0a489b461f'),
})
