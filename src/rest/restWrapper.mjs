import { BaseWrapper } from './baseWrapper.mjs'

export class RestWrapper extends BaseWrapper {
  constructor(authentication, serviceConfig) {
    super(authentication, serviceConfig)
  }

  /*
    PUBLIC ENDPOINTS
   */

  /*
    Spot Market Data
   */
  getServerTime(params) {
    return this.makeRequest({
      endpoint:  '/0/public/Time"',
      method: 'GET',
      baseUrl: 'public',
      params,
    })
  }

  getSystemStatus(params) {
    return this.makeRequest({
      endpoint:  '/0/public/SystemStatus',
      method: 'GET',
      baseUrl: 'public',
      params,
    })
  }

  getAssetInfo(params) {
    return this.makeRequest({
      endpoint:  '/0/public/Assets',
      method: 'GET',
      baseUrl: 'public',
      params,
    })
  }

  getTradableAssetPairs(params) {
    return this.makeRequest({
      endpoint:  '/0/public/Ticker',
      method: 'GET',
      baseUrl: 'public',
      params,
    })
  }

  getTickerInformation(params) {
    return this.makeRequest({
      endpoint: '/api/v3/margin/accounts',
      method: 'GET',
      baseUrl: 'public',
      params,
    })
  }

  getOhclData(params) {
    return this.makeRequest({
      endpoint:  '/0/public/OHLC',
      method: 'GET',
      baseUrl: 'public',
      params,
    })
  }

  getOrderBook(params) {
    return this.makeRequest({
      endpoint:  '/0/public/Depth',
      method: 'GET',
      baseUrl: 'futures',
      params,
    })
  }

  getRecentTradesLedgers(params) {
    return this.makeRequest({
      endpoint:  '/0/public/Trades',
      method: 'GET',
      baseUrl: 'public',
      params,
    })
  }

  getRecentSpreads(params) {
    return this.makeRequest({
      endpoint:  '/0/public/Spread',
      method: 'GET',
      baseUrl: 'public',
      params,
    })
  }

  /*
    NFT Market Data
   */
  getNFT(params) {
    return this.makeRequest({
      endpoint:  '/0/public/Nft',
      method: 'GET',
      baseUrl: 'public',
      params,
    })
  }

  listNFTs(params) {
    return this.makeRequest({
      endpoint:  '/0/public/Nfts',
      method: 'GET',
      baseUrl: 'public',
      params,
    })
  }

  getNftProvenance(params) {
    return this.makeRequest({
      endpoint:  '/0/public/NftProvenance',
      method: 'GET',
      baseUrl: 'public',
      params,
    })
  }

  getNftCollection(params) {
    return this.makeRequest({
      endpoint:  '/0/public/NftCollection',
      method: 'GET',
      baseUrl: 'public',
      params,
    })
  }

  listNftCollections(params) {
    return this.makeRequest({
      endpoint: '/api/v2/sub/user/created',
      method: 'POST',
      baseUrl: 'public',
      params,
    })
  }

  getNftCreator(params) {
    return this.makeRequest({
      endpoint:  '/0/public/NftCreator',
      method: 'POST',
      baseUrl: 'public',
      params,
    })
  }

  listNftCreators(params) {
    return this.makeRequest({
      endpoint:  '/0/public/NftCreators',
      method: 'GET',
      baseUrl: 'public',
      params,
    })
  }

  listNftBlockchains(params) {
    return this.makeRequest({
      endpoint:  '/0/public/NftBlockchains',
      method: 'GET',
      baseUrl: 'public',
      params,
    })
  }

  getNftAuctions(params) {
    return this.makeRequest({
      endpoint:  '/0/public/NftAuctions',
      method: 'GET',
      baseUrl: 'public',
      params,
    })
  }

  getNftOffers(params) {
    return this.makeRequest({
      endpoint:  '/0/public/NftOffers',
      method: 'GET',
      baseUrl: 'public',
      params,
    })
  }

  getNftQuotes(params) {
    return this.makeRequest({
      endpoint:  '/0/public/NftQuotes',
      method: 'GET',
      baseUrl: 'public',
      params,
    })
  }

  /*
    AUTHENTICATED ENDPOINTS
   */

  /*
    Account Data
   */
  getAccountBalance(params) {
    return this.makeRequest({
      endpoint: 'getAccount Balance ',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  getExtendedBalance(params) {
    return this.makeRequest({
      endpoint:  '/0/private/BalanceEx',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  getTradeBalance(params) {
    return this.makeRequest({
      endpoint:  '/0/private/TradeBalance',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  getOpenOrders(params) {
    return this.makeRequest({
      endpoint:  '/0/private/OpenOrders',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  getClosedOrders(params) {
    return this.makeRequest({
      endpoint:  '/0/private/ClosedOrders',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  queryOrdersInfo(params) {
    return this.makeRequest({
      endpoint:  '/0/private/QueryOrders',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  getTradesHistory(params) {
    return this.makeRequest({
      endpoint:  '/0/private/TradesHistory',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  queryTradesInfo(params) {
    return this.makeRequest({
      endpoint:  '/0/private/QueryTrades',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  getOpenPositions(params) {
    return this.makeRequest({
      endpoint:  '/0/private/OpenPositions',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  getLedgersInfo(params) {
    return this.makeRequest({
      endpoint:  '/0/private/Ledgers',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  queryLedgers(params) {
    return this.makeRequest({
      endpoint:  '/0/private/QueryLedgers',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  getTradeVolume(params) {
    return this.makeRequest({
      endpoint:  '/0/private/TradeVolume',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  requestExportReport(params) {
    return this.makeRequest({
      endpoint:  '/0/private/AddExport',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  getExportReportStatus(params) {
    return this.makeRequest({
      endpoint:  '/0/private/ExportStatus',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  retrieveDataExport(params) {
    return this.makeRequest({
      endpoint:  '/0/private/RetrieveExport',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  deleteExportReport(params) {
    return this.makeRequest({
      endpoint:  '/0/private/RemoveExport',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  /*
    Spot Trading
   */
  addOrder(params) {
    return this.makeRequest({
      endpoint:  '/0/private/AddOrder',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  addOrderBatch(params) {
    return this.makeRequest({
      endpoint:  '/0/private/AddOrderBatch',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  editOrder(params) {
    return this.makeRequest({
      endpoint:  '/0/private/EditOrder',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  cancelOrder(params) {
    return this.makeRequest({
      endpoint:  '/0/private/CancelOrder',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  cancelAllOrders(params) {
    return this.makeRequest({
      endpoint:  '/0/private/CancelAll',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  cancelAllOrdersAfter(params) {
    return this.makeRequest({
      endpoint:  '/0/private/CancelAllOrdersAfter',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  cancelOrderBatch(params) {
    return this.makeRequest({
      endpoint:  '/0/private/CancelOrderBatch',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  /*
    NFT Trading
   */
  createNftAuction(params) {
    return this.makeRequest({
      endpoint: '/0/private/NftCreateAuction',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  modifyNftAuction(params) {
    return this.makeRequest({
      endpoint: '/0/private/NftModifyAuction',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  cancelNftAuction(params) {
    return this.makeRequest({
      endpoint: '/0/private/NftCancelAuction',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  placeNftOffer(params) {
    return this.makeRequest({
      endpoint: '',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  cancelNftOffer(params) {
    return this.makeRequest({
      endpoint: '/0/private/NftCancelOffer',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  counterNftOffer(params) {
    return this.makeRequest({
      endpoint: '/0/private/NftCounterOffer',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  acceptNftOffer(params) {
    return this.makeRequest({
      endpoint: '/0/private/NftAcceptOffer',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  getNftAuctionTrades(params) {
    return this.makeRequest({
      endpoint: '/0/private/NftAuctionTrades',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  getNftUserOffers(params) {
    return this.makeRequest({
      endpoint: '/0/private/NftUserOffers',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  getNftWallet(params) {
    return this.makeRequest({
      endpoint: '/0/private/NftWallet',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  listNftTransactions(params) {
    return this.makeRequest({
      endpoint: '/0/private/NftTransactions',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  /*
    Funding
   */
  getDepositMethods(params) {
    return this.makeRequest({
      endpoint: '/0/private/DepositMethods',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  getDepositAddresses(params) {
    return this.makeRequest({
      endpoint: '/0/private/DepositAddresses',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  getDepositStatus(params) {
    return this.makeRequest({
      endpoint: '/0/private/DepositStatus',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  getWithdrawalMethods(params) {
    return this.makeRequest({
      endpoint: '/0/private/WithdrawMethods',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  getWithdrawalAddresses(params) {
    return this.makeRequest({
      endpoint: '/0/private/WithdrawAddresses',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  getWithdrawalInformation(params) {
    return this.makeRequest({
      endpoint: '/0/private/WithdrawInfo',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  withdrawFunds(params) {
    return this.makeRequest({
      endpoint: '/0/private/Withdraw',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  getWithdrawalsStatus(params) {
    return this.makeRequest({
      endpoint: '/0/private/WithdrawStatus',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  requestWithdrawalCancelation(params) {
    return this.makeRequest({
      endpoint: '/0/private/WithdrawCancel',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  requestWalletTransfer(params) {
    return this.makeRequest({
      endpoint: '/0/private/WalletTransfer',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  /*
    Subaccounts
  */
  createSubaccount(params) {
    return this.makeRequest({
      endpoint: '/0/private/CreateSubaccount',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  accountTransfer(params) {
    return this.makeRequest({
      endpoint: '/0/private/AccountTransfer',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  /*
    Earn
  */
  allocateEarnFunds(params) {
    return this.makeRequest({
      endpoint: '/0/private/Earn/Allocate',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  deallocateEarnFunds(params) {
    return this.makeRequest({
      endpoint: '/0/private/Earn/Deallocate',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  getEarnAllocationStatus(params) {
    return this.makeRequest({
      endpoint: '/0/private/Earn/AllocateStatus',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  getEarnDeallocationStatus(params) {
    return this.makeRequest({
      endpoint: '/0/private/Earn/DeallocateStatus',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  listEarnStrategies(params) {
    return this.makeRequest({
      endpoint: '/0/private/Earn/Strategies',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  listEarnAllocations(params) {
    return this.makeRequest({
      endpoint: '/0/private/Earn/Allocations',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }

  /*
    Websockets Authentication
  */
  getWebsocketsToken(params) {
    return this.makeRequest({
      endpoint: '/0/private/GetWebSocketsToken',
      method: 'POST',
      requiresAuth: true,
      baseUrl: 'production',
      params,
    })
  }
}
