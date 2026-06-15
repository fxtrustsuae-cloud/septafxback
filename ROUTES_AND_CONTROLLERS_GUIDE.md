# Routes and Controllers Guide

## Routing architecture

- `index.js` boots the Express app, serves Swagger at `/api-docs`, serves `public/`, and mounts `router.js`.
- `router.js` mounts three main API namespaces:
- `/admin` -> `admin/router/router.js`
- `/user` -> `user/router/router.js`
- `/marketing` -> `marketing/router/router.js`
- Common auth middleware:
- `verifyJWTToken` protects the user/admin APIs and some legacy marketing route files.
- `verifyJWTTokenMarketing` protects the marketing panel APIs.
- Common authorization middleware:
- `checkAdminPermission("...")` is the admin RBAC layer.
- `checkPermission("...")` is the marketing-member permission layer.

## Admin API

### `/admin/auth` -> `admin/controller/auth.controller.js`

- `POST /admin/auth/login` -> `login`: logs in an `ADMIN` or `SUPER-ADMIN` user.
- `POST /admin/auth/marketing/login` -> `marketingLogin`: legacy marketing-member login exposed under the admin namespace.
- `GET /admin/auth/login/history` -> `loginHistory`: returns paginated login history, optionally filtered by user.

### `/admin/admin-permission` -> `admin/controller/adminPermission.controller.js`

- `POST /admin/admin-permission/create-admin` -> `createAdmin`: creates another admin account.
- `GET /admin/admin-permission/list` -> `getAdminPermission`: returns permission assignments for an admin.
- `POST /admin/admin-permission/update` -> `updateAdminPermission`: updates an admin's permissions.
- `GET /admin/admin-permission/admin-list` -> `adminList`: lists admins.
- `POST /admin/admin-permission/seed` -> `seedPermissionsForAdmin`: seeds default permission records for an admin.

### `/admin/banner` -> `admin/controller/banner.controller.js`

- `POST /admin/banner/upload` -> `uploadBanner`: uploads a banner image.
- `GET /admin/banner/` -> `getBanner`: fetches banner data. This one is public.
- `DELETE /admin/banner/` -> `deleteBanner`: deletes a banner.

### `/admin/company-config` -> `admin/controller/companyConfig.controller.js`

- `POST /admin/company-config/add` -> `addCompanyBank`: creates a company bank detail record.
- `PUT /admin/company-config/update` -> `updateCompanyBank`: updates a company bank detail record.
- `GET /admin/company-config/list` -> `publicCompanyBankList`: public listing of company bank details.
- `POST /admin/company-config/exchange-rate/add` -> `addCurrencyExchangeRate`: creates a currency exchange rate.
- `PUT /admin/company-config/exchange-rate/update` -> `updateCurrencyExchangeRate`: updates a currency exchange rate.
- `GET /admin/company-config/exchange-rate/list` -> `publicCurrencyExchangeRateList`: public listing of exchange rates.

### `/admin/copy-trade` -> `admin/controller/copyTrade.controller.js`

- `GET /admin/copy-trade/subscriptions/list` -> `listCopyTradeSubscriptions`: lists copy-trade subscriptions.
- `GET /admin/copy-trade/subscriptions/:id` -> `getCopyTradeSubscription`: gets one subscription by id.
- `POST /admin/copy-trade/subscriptions/pause` -> `pauseCopyTradeSubscription`: pauses a subscription.
- `POST /admin/copy-trade/subscriptions/resume` -> `resumeCopyTradeSubscription`: resumes a subscription.
- `DELETE /admin/copy-trade/subscriptions/:id` -> `deleteCopyTradeSubscription`: deletes a subscription.
- `GET /admin/copy-trade/stats` -> `getSubscriptionStats`: returns copy-trade subscription metrics.

### `/admin/dashboard` -> `admin/controller/dashboard.controller.js`

- `GET /admin/dashboard/` -> `dashboard`: high-level admin dashboard stats.
- `GET /admin/dashboard/transaction` -> `transactionDashboard`: transaction-specific dashboard metrics.
- `GET /admin/dashboard/user` -> `userDashboard`: user-specific dashboard metrics.
- `POST /admin/dashboard/app-setting` -> `appSetting`: updates app-level settings.
- `GET /admin/dashboard/app-setting` -> `getAppSetting`: returns app settings. This one is public.

### `/admin/deals` -> `admin/controller/deals.controller.js`

- `GET /admin/deals/deal/ticket` -> `getDealByTicket`: fetches a single deal by ticket.
- `GET /admin/deals/deal/list` -> `getDealsList`: lists deals.
- `GET /admin/deals/deal/page` -> `getDealsPage`: paginated deal history lookup.
- `GET /admin/deals/deal/batch` -> `getDealBatch`: batched deal retrieval.
- `PUT /admin/deals/deal/update` -> `updateDeal`: updates stored deal data.
- `DELETE /admin/deals/deal/delete` -> `deleteDeal`: deletes stored deal data.

### `/admin/group` -> `admin/controller/group.controller.js`

- `GET /admin/group/mt5/list` -> `mt5GroupList`: lists MT5 groups from MetaTrader.
- `POST /admin/group/create` -> `createGroup`: creates a CRM group record.
- `GET /admin/group/list` -> `groupList`: lists stored groups.
- `GET /admin/group/:id` -> `singleGroup`: fetches one group.
- `PUT /admin/group/update` -> `updateGroup`: updates a group.

### `/admin/ib` -> `admin/controller/ibUser.controller.js`

- `GET /admin/ib/list` -> `ibList`: lists IB users.
- `PUT /admin/ib/update` -> `updateIb`: updates IB profile/configuration.
- `POST /admin/ib/add/plan-name` -> `addIbComissionPlan`: creates a commission plan name.
- `GET /admin/ib/plan-name/list` -> `IbComissionPlanNameList`: lists commission plan names.
- `POST /admin/ib/add/plan` -> `addPlan`: creates an IB commission plan.
- `GET /admin/ib/plan/list` -> `ibPlanList`: lists IB plans.
- `PUT /admin/ib/update/plan` -> `updatePlan`: updates an IB plan.
- `POST /admin/ib/set/sub-ib-comission` -> `setSubIbComission`: sets sub-IB commission rules.
- `PUT /admin/ib/update/sub-ib-comission` -> `updateSubIbComission`: updates sub-IB commission rules.
- `GET /admin/ib/sub-ib-comission/list` -> `subIbComissionList`: lists sub-IB commission settings.
- `POST /admin/ib/user/move-to-ib` -> `moveUserToIb`: converts or assigns a user into IB.
- `POST /admin/ib/remove/user-from-ib` -> `removeUserFromIb`: removes a user from IB.
- `GET /admin/ib/comission/trx-list` -> `ibComissionList`: lists IB commission transactions.
- `GET /admin/ib/report` -> `ibReport`: returns IB reporting/aggregation data.

### `/admin/logs` -> `admin/controller/log.controller.js`

- `GET /admin/logs/list` -> `listLogs`: lists log files from `logs/`.
- `GET /admin/logs/download/:filename` -> `downloadLog`: downloads a log file.
- `GET /admin/logs/view/:filename` -> `getLogContent`: returns parsed log lines with filters.

### `/admin/lots-calculation` -> `admin/controller/lotsCalculation.controller.js`

- `POST /admin/lots-calculation/upload` -> `uploadLotsCalculation`: uploads a spreadsheet and processes lot calculations.
- `GET /admin/lots-calculation/export/:sessionId` -> `exportLotsCalculation`: exports a processed calculation session.

### `/admin/marketing` -> `admin/controller/marketing.controller.js`

- `POST /admin/marketing/add-member` -> `addMarketingMember`: creates a marketing team member.
- `GET /admin/marketing/member-list` -> `marketingMemberList`: lists marketing members.
- `GET /admin/marketing/member/:id` -> `marketingMemberById`: gets one marketing member.
- `PUT /admin/marketing/update-member` -> `updateMarketingMember`: updates a marketing member.
- `PUT /admin/marketing/assing-manager` -> `assignManager`: assigns a manager over marketing users.
- `GET /admin/marketing/incentive-list` -> `incentiveList`: lists incentive records.
- `GET /admin/marketing/incentive/:id` -> `incentiveById`: gets one incentive record.
- `POST /admin/marketing/bulk-upload` -> `bulkUpload`: uploads a CSV of leads.
- `POST /admin/marketing/add-lead` -> `addLead`: creates a lead manually.
- `GET /admin/marketing/lead-list` -> `leadList`: lists leads.
- `GET /admin/marketing/lead/:id` -> `leadById`: gets one lead.
- `POST /admin/marketing/assign-to` -> `leadAssignTo`: assigns a lead to a marketing member.
- `PUT /admin/marketing/update/lead` -> `leadUpdate`: updates lead details/status.
- `GET /admin/marketing/permission/list` -> `getPermission`: lists marketing permissions.
- `POST /admin/marketing/update/permission` -> `updatePermission`: updates marketing permissions.
- `POST /admin/marketing/assign-user` -> `userAssignTo`: assigns users to marketing members.
- `GET /admin/marketing/assign-user-list` -> `marketingUserAssingList`: lists current user assignments.
- `POST /admin/marketing/assign-ib` -> `ibAssignTo`: assigns IB relationships to marketing members.

### `/admin/master-trader` -> `admin/controller/masterTrader.controller.js`

- `POST /admin/master-trader/create` -> `createMasterTrader`: creates a copy-trading master profile.
- `GET /admin/master-trader/list` -> `listMasterTraders`: lists masters with filters.
- `GET /admin/master-trader/:id` -> `getMasterTraderById`: returns one master trader.
- `GET /admin/master-trader/trade-list/:masterTraderId` -> `getMasterTraderTradeList`: returns a master's trade history.
- `GET /admin/master-trader/watchers/list` -> `getMasterTraderWatchers`: lists users watching masters.
- `GET /admin/master-trader/copiers/list` -> `getMasterTraderCopiers`: lists users subscribed/copied.
- `GET /admin/master-trader/watchers/analytics` -> `watchlistAnalytics`: returns watcher analytics.
- `PUT /admin/master-trader/update` -> `updateMasterTrader`: updates a master trader profile/settings.

### `/admin/mt5` -> `admin/controller/mt5User.controller.js`

- `GET /admin/mt5/user` -> `getUser`: gets MT5 user data.
- `POST /admin/mt5/user/add` -> `addUser`: creates an MT5 account.
- `PUT /admin/mt5/user/update` -> `updateUser`: updates an MT5 account.
- `DELETE /admin/mt5/user/delete` -> `deleteUser`: deletes or disables an MT5 account.
- `PUT /admin/mt5/user/change/password` -> `changePassword`: changes MT5 passwords.
- `GET /admin/mt5/user/trade/status` -> `tradeStatus`: returns trade-enabled status.
- `GET /admin/mt5/user/check/balance` -> `checkBalance`: returns MT5 balance.
- `POST /admin/mt5/user/deposit/balance` -> `metaDeposit`: deposits into MT5.
- `POST /admin/mt5/user/withdraw/balance` -> `metaWithdraw`: withdraws from MT5.
- `POST /admin/mt5/change/user` -> `moveMt5User`: moves an MT5 account between users.
- `POST /admin/mt5/import/account` -> `importMt5toUser`: imports an existing MT5 account into CRM.
- `GET /admin/mt5/requested/list` -> `requestedMt5List`: lists requested MT5 accounts.
- `POST /admin/mt5/requested/approve-reject` -> `approveRejectRequestedMt5`: approves or rejects requested MT5 accounts.

### `/admin/position` -> `admin/controller/position.controller.js`

- `GET /admin/position/symbol` -> `getSymbolPosition`: positions filtered by symbol.
- `GET /admin/position/list` -> `positionList`: open positions list.
- `GET /admin/position/open-order/list` -> `getOpenOrderList`: open orders list.
- `POST /admin/position/close/position` -> `closeTradeByPosition`: closes an open position.
- `POST /admin/position/close/limit/order` -> `closeLimitTradeOrder`: closes a pending order.
- `GET /admin/position/closed-order/list` -> `closedOrderList`: closed-order history.

### `/admin/support` -> `admin/controller/support.controller.js`

- `GET /admin/support/list` -> `ticketList`: lists support tickets.
- `GET /admin/support/:id` -> `singleTicket`: gets one support ticket.
- `POST /admin/support/close` -> `updateTicket`: closes a support ticket.
- `PUT /admin/support/replay` -> `replay`: replies to a support ticket.

### `/admin/transaction` -> `admin/controller/transaction.controller.js`

- `POST /admin/transaction/client/deposit` -> `metaDeposit`: direct deposit into client MT5 account.
- `POST /admin/transaction/client/withdraw` -> `metaWithdraw`: direct withdraw from client MT5 account.
- `POST /admin/transaction/wallet-to-meta-deposit` -> `walletToMetaDeposit`: moves wallet balance into MT5.
- `POST /admin/transaction/meta-to-wallet-withdraw` -> `metaToWalletWithdraw`: moves MT5 balance back into wallet.
- `POST /admin/transaction/wallet/deposit` -> `walletDeposit`: credits CRM wallet.
- `POST /admin/transaction/wallet/withdraw` -> `walletWithdraw`: debits CRM wallet.
- `POST /admin/transaction/wallet/remove-bonus` -> `removeBonus`: removes a bonus/credit deposit.
- `GET /admin/transaction/list` -> `transactionList`: paginated ledger listing, with optional Excel export.
- `GET /admin/transaction/deposit-withdraw/list` -> `depositWithdrawList`: lists bank/crypto deposit-withdraw requests.
- `GET /admin/transaction/deposit-withdraw/:id` -> `singleDepositWithdraw`: fetches one deposit-withdraw request.
- `PUT /admin/transaction/update/deposit-withdraw` -> `apporveRejectDepositWithdraw`: approves or rejects a client deposit/withdraw request.
- `PUT /admin/transaction/update/deposit-withdraw-amount` -> `updateDepositWithdrawAmount`: edits request amount.
- `POST /admin/transaction/ib-withdraw` -> `ibWithdraw`: processes IB wallet withdrawals.
- Commented routes in this file:
- `PUT /withdraw/app-rej`
- `POST /internal/transfer`

### `/admin/user` -> `admin/controller/user.controller.js`

- `POST /admin/user/add` -> `addUser`: creates a CRM user.
- `PUT /admin/user/update` -> `updateUser`: updates a CRM user.
- `GET /admin/user/list` -> `userList`: lists CRM users.
- `GET /admin/user/asset/list` -> `assetList`: lists wallet/asset rows.
- `GET /admin/user/:id` -> `userById`: gets one user.
- `POST /admin/user/mt5-add` -> `addMT5User`: creates and links an MT5 account for a user.
- `GET /admin/user/mt5/list` -> `mt5UserList`: lists users with MT5 accounts.
- `GET /admin/user/mt5/:id` -> `mt5UserById`: gets one user MT5 mapping.
- `POST /admin/user/add/bank` -> `addBank`: creates a bank/KYC bank record.
- `GET /admin/user/referral/list` -> `referralList`: lists referrals.
- `GET /admin/user/referral/tree` -> `getUserReferralTree`: returns a referral tree.
- `GET /admin/user/bank/list` -> `bankList`: lists bank detail records.
- `GET /admin/user/bank/:id` -> `bankById`: gets one bank detail record.
- `PUT /admin/user/update/bank` -> `updateBank`: updates bank details.
- `PUT /admin/user/approve/bank` -> `approveBank`: approves or rejects bank data.
- `POST /admin/user/upload/doc` -> `uploadDocument`: uploads KYC documents.
- `GET /admin/user/document/list` -> `documentList`: lists documents/KYC records.
- `PUT /admin/user/update/kyc` -> `approveKyc`: approves or rejects KYC.
- `GET /admin/user/password/list` -> `passwordList`: lists stored password records.
- `PUT /admin/user/password/change` -> `changePassword`: admin resets a user's login password.
- `PUT /admin/user/update/mt5` -> `updateMt5`: updates linked MT5 credentials/settings in stored records.
- `GET /admin/user/bank/deposit/list` -> `bankDepositList`: lists user bank deposit requests.
- `GET /admin/user/action-tracking` -> `actionTrackingList`: lists action/audit records.
- `POST /admin/user/send-email` -> `sendEmail`: sends account or operational email to a user.

## User API

### Root user routes `/user` -> `user/controller/user.controller.js` and `user/controller/paymentNotification.controller.js`

- `PUT /user/profile/update` -> `updateUserProfile`: updates profile fields.
- `POST /user/create/trxpassword` -> `createTransactionPassword`: creates transaction password/QA security.
- `PUT /user/change/trxpassword` -> `changeTransactionPassword`: changes transaction password/QA security.
- `POST /user/add/bank/account` -> `addBankDetails`: adds user bank account details.
- `GET /user/fetch/bank` -> `getBankDetails`: returns saved bank account details.
- `GET /user/referral/list` -> `referralList`: lists direct/downline referrals.
- `GET /user/referral/tree` -> `getUserReferralTree`: returns referral tree data.
- `GET /user/transaction/list` -> `transactionList`: lists CRM wallet transactions.
- `POST /user/bank/deposit` -> `bankDeposit`: creates a manual bank deposit request with proof image.
- `POST /user/bank/withdraw` -> `bankWithdraw`: creates a wallet withdrawal request.
- `GET /user/deposit-withdraw/list` -> `depositWithdrawList`: lists the user's deposit/withdraw requests.
- `POST /user/ib/request` -> `requestIb`: requests IB status or onboarding.
- `GET /user/ib/request` -> `getRequestIb`: returns current IB request state.
- `GET /user/updated/data` -> `getUpdatedDetails`: refresh endpoint for updated user/profile data.
- `POST /user/notifiaction` -> `paymentNotification`: payment gateway webhook callback.
- `POST /user/card/payment/notification` -> `cardPaymentNotification`: card gateway callback.
- `GET /user/yopips/trail` -> `yopipsTrail`: integration endpoint around the Yopips flow.
- `POST /user/meta/deposit` -> `metaDeposit`: user-triggered MT5 deposit flow.
- `POST /user/meta/withdraw` -> `metaWithdraw`: user-triggered MT5 withdraw flow.
- `POST /user/withdraw` -> `withdrawUsdt`: user crypto/USDT withdrawal request.
- `PUT /user/update/security-method` -> `updateSecuriyMethod`: switches MFA/verification method.
- `PUT /user/update/profile-img` -> `updateProfile`: uploads profile image.
- `GET /user/ib/comission-list` -> `ibComissionList`: user's IB commission transactions.
- `POST /user/accept-promotional` -> `acceptPromotion`: marks promotional consent/acceptance.

### `/user/auth` -> `user/controller/auth.controller.js`

- `POST /user/auth/signup` -> `signUp`: registers a new user.
- `GET /user/auth/referral/info` -> `referralInfo`: checks a referral code and returns basic referrer data.
- `POST /user/auth/login` -> `login`: user login.
- `GET /user/auth/login/history` -> `loginHistory`: the user's login history.
- `POST /user/auth/logout` -> `logOut`: invalidates active token/session.
- `POST /user/auth/send/otp` -> `sendOtp`: sends OTP for email/mobile verification.
- `PATCH /user/auth/verify/otp` -> `verifyOtp`: verifies OTP.
- `PUT /user/auth/change/login/password` -> `changePassword`: changes login password.
- `POST /user/auth/forgot/password/send/otp` -> `forgetPasswordSendOtp`: starts forgot-password flow.
- `PATCH /user/auth/forgot/password/verify/otp` -> `forgetPasswordVerifyOtp`: verifies forgot-password OTP and issues reset token.
- `PUT /user/auth/reset/password` -> `resetPassword`: resets password after OTP flow.
- `POST /user/auth/setup/mfa` -> `setup2fa`: provisions or verifies MFA setup.

### `/user/compliance` -> `user/controller/compliance.controller.js`

- `POST /user/compliance/add/bank` -> `addBank`: uploads/submits bank info for compliance.
- `PUT /user/compliance/update/bank` -> `updateBank`: updates bank info.
- `POST /user/compliance/upload/doc` -> `uploadDocument`: uploads POI/POA/extra compliance documents.
- `GET /user/compliance/bank/details` -> `getbank`: returns compliance bank details.
- `GET /user/compliance/document/details` -> `getDocument`: returns compliance document details.

### `/user/ib` -> `user/controller/ib.controller.js`

- `GET /user/ib/comission` -> `getIbComission`: IB commission overview.
- `PUT /user/ib/make-subib` -> `makeSubIb`: converts or configures a user as sub-IB.
- `GET /user/ib/client/trx-list` -> `teamTrxReport`: team transaction report.
- `GET /user/ib/kyc-report` -> `ibKycReport`: KYC report for downline.
- `GET /user/ib/live-account` -> `liveAccount`: live-account report for downline.
- `POST /user/ib/withdraw` -> `ibWithdraw`: IB commission withdrawal request.
- `GET /user/ib/ftd-report` -> `ftdRefReport`: first-time-deposit referral report.

### `/user/master-trader` -> `user/controller/masterTrader.controller.js`

- `GET /user/master-trader/list` -> `masterTraderList`: catalog of master traders.
- `GET /user/master-trader/detail` -> `getMasterTraderDetail`: detail lookup for a master.
- `POST /user/master-trader/review` -> `submitMasterTraderReview`: creates a master trader review.
- `DELETE /user/master-trader/review/:masterTraderId` -> `deleteMasterTraderReview`: removes a review.
- `GET /user/master-trader/reviews/:masterTraderId` -> `getMasterTraderReviews`: lists reviews.
- `POST /user/master-trader/watch` -> `watchMasterTrader`: adds a master to watchlist.
- `DELETE /user/master-trader/unwatch/:masterTraderId` -> `unwatchMasterTrader`: removes from watchlist.
- `GET /user/master-trader/my-watchlist` -> `getMyWatchlist`: returns the current user's watchlist.
- `PUT /user/master-trader/watchlist/notification` -> `toggleWatchlistNotifications`: turns watchlist notifications on/off.
- `POST /user/master-trader/subscribe` -> `subscribeMasterTrader`: starts a copy-trade subscription.
- `POST /user/master-trader/unsubscribe` -> `unsubscribeMasterTrader`: stops a subscription.
- `GET /user/master-trader/my-subscriptions` -> `getMySubscriptions`: lists current subscriptions.
- `PUT /user/master-trader/subscription/settings` -> `updateSubscriptionSettings`: updates limits/settings.
- `POST /user/master-trader/subscription/pause` -> `pauseSubscription`: pauses copying.
- `POST /user/master-trader/subscription/resume` -> `resumeSubscription`: resumes copying.
- `PUT /user/master-trader/subscription/update` -> `updateSubscription`: general subscription update endpoint.
- `GET /user/master-trader/trade-list/:masterTraderId` -> `getMasterTraderTradeList`: master trade history.
- `GET /user/master-trader/copiers/:masterTraderId` -> `getMasterTraderCopiers`: copier list for one master.
- `GET /user/master-trader/:masterTraderId` -> `getMasterTraderDetail`: alternate detail endpoint by id.

### `/user/mt5` -> `user/controller/mt5User.controller.js`

- `GET /user/mt5/group/list` -> `groupList`: available MT5 groups/plans.
- `GET /user/mt5/account/list` -> `mt5AccountList`: user's MT5 accounts.
- `GET /user/mt5/account/:id` -> `mt5AccountById`: one MT5 account.
- `POST /user/mt5/create/account` -> `addMt5Account`: requests/creates a new MT5 account.
- `GET /user/mt5/requested/account/list` -> `requestedMt5AccountList`: pending MT5 account requests.
- `POST /user/mt5/add/demo-balance` -> `demoAddBalance`: adds demo funds.
- `PUT /user/mt5/update/account` -> `updateMt5User`: updates MT5 account settings.
- `PUT /user/mt5/update/default-symbol` -> `updateMt5DefaultSymbol`: updates default symbols.
- `PUT /user/mt5/change-password` -> `updateMt5Password`: changes MT5 password.
- `DELETE /user/mt5/delete/account` -> `deleteUser`: deletes/disables MT5 account.
- `GET /user/mt5/user/trade/status` -> `tradeStatus`: MT5 trade-enabled status.
- `GET /user/mt5/user/check/balance` -> `checkBalance`: MT5 balance check.

### `/user/support` -> `user/controller/support.controller.js`

- `POST /user/support/create` -> `createTicket`: creates a support ticket.
- `GET /user/support/list` -> `ticketList`: lists the user's tickets.
- `GET /user/support/:id` -> `singleTicket`: gets one ticket.
- `POST /user/support/close` -> `closeTicket`: closes a ticket.
- `PUT /user/support/replay` -> `replay`: replies to a ticket.

### `/user/trade` -> `user/controller/trade.controller.js`

- `POST /user/trade/deposit/balance` -> `metaDeposit`: deposits to MT5 from trading screen.
- `POST /user/trade/withdraw/balance` -> `metaWithdraw`: withdraws from MT5 from trading screen.
- `POST /user/trade/send/trade/request` -> `sendTrade`: opens a market trade.
- `POST /user/trade/close/position` -> `closeTradeByPosition`: closes an open position.
- `POST /user/trade/limit/order` -> `limitTradeOrder`: places a pending order.
- `POST /user/trade/modify/order` -> `modifyTradeOrder`: edits an open/pending order.
- `POST /user/trade/close/limit/order` -> `closeLimitTradeOrder`: closes a pending order.
- `GET /user/trade/check/balance` -> `checkBalance`: trading account balance.
- `GET /user/trade/closed/order-list` -> `closedOrderList`: closed trades.
- `GET /user/trade/bot/list` -> `botList`: available bots/robots list.
- `POST /user/trade/update/watchlist` -> `updateWatchList`: adds/removes watchlist items.
- `GET /user/trade/watchlist` -> `getWatchList`: returns watchlist.

### `/user/analytics` -> `user/controller/analytics.controller.js`

- `GET /user/analytics/economics-calender` -> `echonomicsCalander`: economic calendar feed.

## Marketing API

### Marketing mounts from `marketing/router/router.js`

- Active route groups:
- `/marketing/auth`
- `/marketing/user`
- `/marketing/` through `marketing/router/marketing.route.js`
- `/marketing/group`
- `/marketing/support`
- `/marketing/dashboard`
- `/marketing/transaction`
- Route files present but not mounted right now:
- `marketing/router/ibUser.route.js`
- `marketing/router/mt5User.route.js`
- `marketing/router/deals.route.js`
- `marketing/router/banner.router.js`
- `marketing/router/position.route.js`

### `/marketing/auth` -> `marketing/controller/auth.controller.js`

- `POST /marketing/auth/login` -> `marketingLogin`: marketing member login.

### `/marketing/user` -> `marketing/controller/user.controller.js`

- `POST /marketing/user/add` -> `addUser`: creates a user assigned through the marketing panel.
- `GET /marketing/user/list` -> `userList`: lists users visible to the marketing member.
- `GET /marketing/user/:id` -> `userById`: gets one assigned user.
- `POST /marketing/user/mt5-add` -> `addMT5User`: creates/links MT5 account for an assigned user.
- `GET /marketing/user/mt5/list` -> `mt5UserList`: lists MT5-linked users.
- `GET /marketing/user/mt5/:id` -> `mt5UserById`: fetches one MT5-linked user.
- `POST /marketing/user/add/bank` -> `addBank`: submits bank info/KYC bank record.
- `GET /marketing/user/bank/list` -> `bankList`: lists bank records.
- `GET /marketing/user/bank/:id` -> `bankById`: fetches one bank record.
- `PUT /marketing/user/approve/bank` -> `approveBank`: approves/rejects bank details.
- `GET /marketing/user/referral/list` -> `referralList`: referral listing.
- `POST /marketing/user/upload/doc` -> `uploadDocument`: uploads KYC docs.
- `GET /marketing/user/document/list` -> `documentList`: lists documents.
- `PUT /marketing/user/update/kyc` -> `approveKyc`: approves/rejects KYC.
- `GET /marketing/user/password/list` -> `passwordList`: password record listing for assigned users.
- `GET /marketing/user/bank/deposit/list` -> `bankDepositList`: bank deposit requests.
- Commented routes in this file:
- `PUT /update`
- `PUT /password/change`
- `PUT /update/mt5`
- `GET /action-tracking`
- `POST /user-assing-to`
- `POST /ib-assing-to`

### `/marketing` root routes -> `marketing/controller/marketing.controller.js`

- `POST /marketing/add-member` -> `addMarketingMember`: creates marketing users from inside the marketing module.
- `GET /marketing/member-list` -> `marketingMemberList`: lists marketing members.
- `GET /marketing/member/:id` -> `marketingMemberById`: gets one marketing member.
- `PUT /marketing/update-member` -> `updateMarketingMember`: updates a marketing member.
- `GET /marketing/incentive-list` -> `incentiveList`: incentive listing.
- `GET /marketing/incentive/:id` -> `incentiveById`: one incentive row.
- `POST /marketing/bulk-upload` -> `bulkUpload`: bulk lead CSV upload.
- `POST /marketing/add-lead` -> `addLead`: creates a lead.
- `GET /marketing/lead-list` -> `leadList`: lead listing.
- `GET /marketing/lead/:id` -> `leadById`: gets one lead.
- `POST /marketing/assign-to` -> `leadAssignTo`: assigns lead ownership.
- `PUT /marketing/update/lead` -> `leadUpdate`: updates a lead.
- `GET /marketing/permission/list` -> `getPermission`: returns permission data for the logged-in marketing member.
- `POST /marketing/update/permission` -> `updatePermission`: updates permission state.

### `/marketing/group` -> `marketing/controller/group.controller.js`

- `GET /marketing/group/list` -> `groupList`: lists groups visible to marketing.
- Commented routes in this file:
- `GET /mt5/list`
- `POST /create`
- `GET /:id`
- `PUT /update`

### `/marketing/support` -> `marketing/controller/support.controller.js`

- `GET /marketing/support/list` -> `ticketList`: ticket listing.
- `GET /marketing/support/:id` -> `singleTicket`: one ticket.
- `POST /marketing/support/close` -> `updateTicket`: closes a ticket.
- `PUT /marketing/support/replay` -> `replay`: replies to a ticket.

### `/marketing/dashboard` -> `marketing/controller/dashboard.controller.js`

- `GET /marketing/dashboard/` -> `dashboard`: marketing dashboard summary.
- `GET /marketing/dashboard/user` -> `userDashboard`: user-focused dashboard.
- Commented route in this file:
- `GET /transaction`

### `/marketing/transaction` -> `marketing/controller/transaction.controller.js`

- `GET /marketing/transaction/list` -> `transactionList`: ledger view for the marketing panel.
- `GET /marketing/transaction/deposit-withdraw/list` -> `depositWithdrawList`: deposit/withdraw request listing.
- `GET /marketing/transaction/deposit-withdraw/:id` -> `singleDepositWithdraw`: fetch one request.
- Commented routes in this file:
- `POST /client/deposit`
- `POST /client/withdraw`
- `POST /wallet/deposit`
- `POST /wallet/withdraw`
- `POST /internal/transfer`
- `PUT /update/deposit-withdraw`

### Marketing route files present but not mounted

These files exist in `marketing/router/`, but `marketing/router/router.js` does not currently `router.use(...)` them, so they will not answer requests unless you mount them.

#### `/marketing/ib` -> `marketing/controller/ibUser.controller.js`

- `GET /marketing/ib/list` -> `ibList`: list IB users.
- `PUT /marketing/ib/update` -> `updateIb`: update IB details.
- `POST /marketing/ib/add/plan` -> `addPlan`: create an IB plan.
- `GET /marketing/ib/plan/list` -> `ibPlanList`: list IB plans.
- `POST /marketing/ib/add/comission/group` -> `addComissionGroup`: create commission group.
- `GET /marketing/ib/comission/group/list` -> `comissionGroupList`: list commission groups.
- `PUT /marketing/ib/update/comission/group` -> `updateComissionGroup`: update commission group.
- `POST /marketing/ib/add/user/comission/group` -> `addUserComissionGroup`: assign user commission group.
- `POST /marketing/ib/user/move-to-ib` -> `moveUserToIb`: move a user into IB.

#### `/marketing/mt5` -> `marketing/controller/mt5User.controller.js`

- `GET /marketing/mt5/user` -> `getUser`: get MT5 user data.
- `POST /marketing/mt5/user/add` -> `addUser`: create MT5 user.
- `PUT /marketing/mt5/user/update` -> `updateUser`: update MT5 user.
- `DELETE /marketing/mt5/user/delete` -> `deleteUser`: delete MT5 user.
- `PUT /marketing/mt5/user/change/password` -> `changePassword`: change MT5 password.
- `GET /marketing/mt5/user/trade/status` -> `tradeStatus`: MT5 trade status.
- `GET /marketing/mt5/user/check/balance` -> `checkBalance`: MT5 balance.
- `POST /marketing/mt5/user/deposit/balance` -> `metaDeposit`: deposit to MT5.
- `POST /marketing/mt5/user/withdraw/balance` -> `metaWithdraw`: withdraw from MT5.
- `POST /marketing/mt5/import/account` -> `importMt5toUser`: import MT5 account.

#### `/marketing/deals` -> `marketing/controller/deals.controller.js`

- `GET /marketing/deals/deal/ticket` -> `getDealByTicket`: deal lookup by ticket.
- `GET /marketing/deals/deal/list` -> `getDealsList`: list deals.
- `GET /marketing/deals/deal/page` -> `getDealsPage`: paginated deals.
- `GET /marketing/deals/deal/batch` -> `getDealBatch`: batched deal fetch.
- `PUT /marketing/deals/deal/update` -> `updateDeal`: update stored deal.
- `DELETE /marketing/deals/deal/delete` -> `deleteDeal`: delete stored deal.

#### `/marketing/banner` -> `marketing/controller/banner.controller.js`

- `POST /marketing/banner/upload` -> `uploadBanner`: upload banner.
- `GET /marketing/banner/` -> `getBanner`: get banners.
- `DELETE /marketing/banner/` -> `deleteBanner`: delete banner.

#### `/marketing/position` -> `marketing/controller/position.controller.js`

- `GET /marketing/position/symbol` -> `getSymbolPosition`: positions by symbol.
- `GET /marketing/position/list` -> `positionList`: open positions list.
- `GET /marketing/position/open-order/list` -> `getOpenOrderList`: open orders list.

## Modular sidecar routes under `modules/`

- `modules/index.js` defines a versioned modular router, but `index.js` does not mount it right now.
- If mounted later, the route prefixes would be:

### `/monetization` -> inline handlers using `modules/monetization/monetization.service.js`

- `POST /monetization/settle-performance-fee`: calculates and settles performance fees.
- `POST /monetization/renew-subscriptions`: renews copy-trade subscriptions.

### `/risk` -> inline handlers using `modules/risk-engine/risk.service.js`

- `POST /risk/evaluate-trade`: evaluates copier trade risk.
- `POST /risk/configure`: stores risk configuration.

### `/social` -> inline handlers using `modules/social/social.service.js`

- `POST /social/posts`: creates a social post for a master trader.
- `GET /social/feed`: personalized feed.
- `GET /social/trending`: global trending feed.
- `POST /social/posts/:postId/like`: likes/unlikes a post.

### `/analytics` -> inline handlers using `modules/analytics/analytics.service.js`

- `GET /analytics/simulate/:masterId`: simulates an equity curve.
- `GET /analytics/metrics/:masterId`: calculates strategy metrics.

## Controller map

### Admin controllers

- `admin/controller/auth.controller.js`: admin and legacy marketing login, plus login audit history.
- `admin/controller/adminPermission.controller.js`: admin creation and permission seeding/updating.
- `admin/controller/banner.controller.js`: banner upload/list/delete.
- `admin/controller/companyConfig.controller.js`: company bank details and exchange rates.
- `admin/controller/copyTrade.controller.js`: subscription lifecycle and copy-trade admin stats.
- `admin/controller/dashboard.controller.js`: dashboard totals and app-setting storage.
- `admin/controller/deals.controller.js`: MT5 deal lookup and local deal maintenance.
- `admin/controller/group.controller.js`: MT5 group sync plus CRM group CRUD.
- `admin/controller/ibUser.controller.js`: IB user management, plans, commission groups, reports.
- `admin/controller/log.controller.js`: log file listing, download, and parsing.
- `admin/controller/lotsCalculation.controller.js`: spreadsheet import/export workflow for lot calculations.
- `admin/controller/marketing.controller.js`: marketing team CRUD, lead management, assignments, permissions.
- `admin/controller/masterTrader.controller.js`: admin-side master trader and copy-trade analytics.
- `admin/controller/mt5User.controller.js`: MT5 user/account operations and request approval.
- `admin/controller/position.controller.js`: open/closed MT5 position and order control.
- `admin/controller/support.controller.js`: admin-side support ticket review and reply.
- `admin/controller/transaction.controller.js`: all wallet, MT5, deposit/withdraw, and IB transaction operations.
- `admin/controller/user.controller.js`: CRM user CRUD, KYC, bank, referral tree, MT5 linkage, audit, email sending.

### User controllers

- `user/controller/auth.controller.js`: signup, login, logout, OTP verification, password reset, MFA.
- `user/controller/analytics.controller.js`: economic calendar feed.
- `user/controller/compliance.controller.js`: bank and document uploads for KYC/compliance.
- `user/controller/deals.controller.js`: deal lookup helpers. Present in the repo but not wired to active user routes.
- `user/controller/ib.controller.js`: IB commissions, sub-IB conversion, downline reports, IB withdrawals.
- `user/controller/masterTrader.controller.js`: master-trader discovery, reviews, watchlist, subscriptions, copier views.
- `user/controller/mt5User.controller.js`: user-side MT5 account lifecycle and settings.
- `user/controller/orders.controller.js`: background/order synchronization logic loaded for side effects in `index.js`, not exposed directly through Express routes.
- `user/controller/payment.controller.js`: payment gateway helper/service code, not an Express route controller.
- `user/controller/paymentNotification.controller.js`: webhook handlers for crypto/card deposit providers.
- `user/controller/posotions.controller.js`: position listing helpers. Present in the repo but not wired to active user routes.
- `user/controller/support.controller.js`: user support ticket CRUD/replies.
- `user/controller/trade.controller.js`: trading operations plus watchlist and bot listing.
- `user/controller/user.controller.js`: profile, bank account, transaction password, wallet transactions, deposit/withdraw, IB request helpers.

### Marketing controllers

- `marketing/controller/auth.controller.js`: marketing login.
- `marketing/controller/banner.controller.js`: banner CRUD. Route file exists but is not mounted.
- `marketing/controller/dashboard.controller.js`: marketing dashboard summaries.
- `marketing/controller/deals.controller.js`: deal lookup/update/delete. Route file exists but is not mounted.
- `marketing/controller/group.controller.js`: marketing-side group listing and detail helpers.
- `marketing/controller/ibUser.controller.js`: marketing-side IB plan/group management. Route file exists but is not mounted.
- `marketing/controller/marketing.controller.js`: marketing-member CRUD, incentives, leads, permission views.
- `marketing/controller/mt5User.controller.js`: marketing-side MT5 account management. Route file exists but is not mounted.
- `marketing/controller/position.controller.js`: marketing-side position lookup. Route file exists but is not mounted.
- `marketing/controller/support.controller.js`: ticket listing/reply/close for marketing members.
- `marketing/controller/transaction.controller.js`: ledger and deposit-withdraw request views, with several mutating handlers currently not routed.
- `marketing/controller/user.controller.js`: marketing-side user/KYC/bank/referral views and some inactive maintenance endpoints.

## Important caveats while reading this codebase

- Some controller files export more functions than the current router mounts.
- Several marketing route files exist but are commented out of `marketing/router/router.js`, so those controllers are dormant from the main app's point of view.
- `modules/index.js` is a separate modular API surface that is currently not connected to the running Express app.
- The repo mixes true HTTP controllers with helper/service files that happen to live in `controller/`.
