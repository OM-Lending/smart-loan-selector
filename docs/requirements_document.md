BANK LIST:
四大，westpac anz cba nab，和Macquarie Bank，ING Australia，Bendigo Bank，Bank of Queensland (BOQ，Bankwest，St George，，AMP Bank，Qudos，BOC，la trobe， Pepper， Think Tank，brighten, 


ADD:me bank
REMOVE: citi australia


✅1. 增加 me bank, 去掉 citi australia, 检查一下resimac 这个银行有咩有, 没有的话就不加了

   Mebank json FROM https://api.cdr.gov.au/cdr-register/v1/banking/data-holders/brands/summary

   ```json
   {
     "dataHolderBrandId": "78883a14-67ae-ed11-a838-000d3a8830d6",
     "brandName": "ME Bank - ME Go",
     "industries": [
       "banking"
     ],
     "logoUri": "https://www.mebank.com.au/getmedia/c79ff77e-5b3b-4410-9a1b-98e98a79f025/ME-logo-600px-black-transparent.png",
     "publicBaseUri": "https://api.cds.mebank.com.au",
     "abn": "32009656740",
     "acn": "009656740",
     "lastUpdated": "2026-09-02T10:52:11Z"
   }
   ```

2. 增加 self employ 这个选项, SE 的话填写 ABN, established date, businese profit,不填写雇员相关信息

✅3. header 中的talk to a broker button 点击之后出现一个覆盖悬浮窗MODAL 不要做点点蒙层关闭) 浮窗中让用户留下他的联系方式以及一个 Message 的输入框,
   这个信息会保存并且写入数据库并且给到 admin 端口去查看(后续还会接入 email 通知admin, 将消息内容和联系方式发送给 admin 邮箱)

✅4. cash out from existing property, Lender 选 other 之后留一个输入框,让用户输入他的 lender

✅5. existing home loan 加上 lender,银行利率和 loan balance, interst rate, 去掉 monthly repartment.

✅6. 增加email 通知功能, 当有新的 application, 完成所有材料递交, 以及通过 talk to a broker 留言的情况,, 给 admin email 发送邮件通知并且email 展示相关信息

✅7. 在完成了推荐之后增加一个我们的 Specialist will review and contact you 这个提示, 提示的类型需要确认下, alter 还是什么之后的

✅8. 婚姻状态只留下 3 个即可, 同步可能还要调整 single parrent 这个产品的筛选条件.
9. 增加一下 privacy term consent
10. 上传文档过程中加一个 loading

✅11. 调整 continue 之后收集信息的表格

如下:

| Customer Fact Find                                       |                                                              |                                                              |      |                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ | ---- | ------------------------------------------------------------ |
| Basic  Information                                       | ☐ New  Purchase                                              | ☐  Refinance                                                 |      |                                                              |
| Applicant Info                                           | Applicant  1                                                 | Applicant  2                                                 |      |                                                              |
| Name                                                     |                                                              |                                                              |      |                                                              |
| DOB  (DD/MM/YYYY)                                        | 不用,  ID 自带                                               |                                                              |      |                                                              |
| Mobile                                                   |                                                              |                                                              |      |                                                              |
| Email Address                                            |                                                              |                                                              |      |                                                              |
| Visa Status                                              | PR() citzen TR                                               |                                                              |      |                                                              |
| Marital Status                                           | -                                                            |                                                              |      |                                                              |
| Number of  Dependent                                     |                                                              |                                                              |      |                                                              |
| DOB  (DD/MM/YYYY) of Dependent                           | -                                                            |                                                              |      |                                                              |
| Centerlink                                               | -                                                            |                                                              |      |                                                              |
| Home Address                                             |                                                              |                                                              |      |                                                              |
| Since  (DD/MM/YYYY)                                      | 3 年                                                         |                                                              |      |                                                              |
| Renting/mortgage/parent/Fully  paid                      |                                                              |                                                              |      |                                                              |
| Previous  Address (If current address< 3yrs)             |                                                              |                                                              |      |                                                              |
| Since  (DD/MM/YYYY)                                      |                                                              |                                                              |      |                                                              |
| Current Job Info                                         |                                                              |                                                              |      |                                                              |
| Annual Income                                            |                                                              |                                                              |      |                                                              |
| Full-time/Part-time/Casual                               |                                                              |                                                              |      |                                                              |
| Employer  Name/ABN                                       | -                                                            |                                                              |      |                                                              |
| Position                                                 |                                                              |                                                              |      |                                                              |
| Office Number                                            | employment  phonenumber                                      |                                                              |      |                                                              |
| Office Address                                           |                                                              |                                                              |      |                                                              |
| Contact Person                                           | -                                                            |                                                              |      |                                                              |
| Start  date                                              |                                                              |                                                              |      |                                                              |
| Salary Account                                           | -                                                            |                                                              |      |                                                              |
| Previous 3 Years  Working History (If current job<3 yrs) |                                                              |                                                              |      |                                                              |
| Employer  Name/ABN                                       |                                                              |                                                              |      |                                                              |
| Position                                                 |                                                              |                                                              |      |                                                              |
| Office Number                                            | employment  phonenumber                                      |                                                              |      |                                                              |
| Office Address                                           |                                                              |                                                              |      |                                                              |
| Contact Person                                           |                                                              |                                                              |      |                                                              |
| Start date and  End date                                 |                                                              |                                                              |      |                                                              |
| Assets &  Liabilities                                    |                                                              |                                                              |      |                                                              |
| Savings (Bank  & Balance)                                |                                                              |                                                              |      |                                                              |
| Home Contents                                            | -                                                            |                                                              |      |                                                              |
| Shares                                                   | -                                                            |                                                              |      |                                                              |
| Superannuation  (Funder & Balance)                       | -                                                            |                                                              |      |                                                              |
| Car (Model,  Year, Value)                                |                                                              |                                                              |      |                                                              |
| Car Loan                                                 |                                                              |                                                              |      |                                                              |
| Credit Card  (Lender& Limit)                             |                                                              |                                                              |      |                                                              |
| Student Loan                                             |                                                              |                                                              |      |                                                              |
| Personal Loan                                            | -                                                            |                                                              |      |                                                              |
| Rent Expense  per week                                   |                                                              |                                                              |      |                                                              |
| Private Health  Insurance                                |                                                              |                                                              |      |                                                              |
| Property                                                 |                                                              |                                                              |      |                                                              |
|                                                          | o/o                                                          | Inv 1                                                        |      |                                                              |
| Property  Address                                        | 自住房                                                       |                                                              |      |                                                              |
| Description(House/Apartment,  No. of bedrooms etc.)      | -                                                            |                                                              |      |                                                              |
| Ownership                                                | example:Applicant 1 : 50% Applicant 2: 50%                   |                                                              |      |                                                              |
| Market  Value                                            | -                                                            |                                                              |      |                                                              |
| Rental per  week                                         |                                                              | 投资方有 rental per week                                     |      |                                                              |
| Lender                                                   | -                                                            |                                                              |      |                                                              |
| Loan Limit                                               | -                                                            |                                                              |      |                                                              |
| Loan  Balance                                            | -                                                            |                                                              |      |                                                              |
| The Loan  Begins from (DD/MM/YYYY)                       | -                                                            | 投资房加一个Leased through an real estate agent /  private leased |      |                                                              |
|                                                          | Inv 2                                                        | Inv 3                                                        |      |                                                              |
| Property  Address                                        |                                                              |                                                              |      |                                                              |
| Description(House/Apartment,  No. of bedrooms etc.)      |                                                              |                                                              |      |                                                              |
| Ownership                                                |                                                              |                                                              |      |                                                              |
| Market  Value                                            |                                                              |                                                              |      |                                                              |
| Rental per  week                                         |                                                              |                                                              |      |                                                              |
| Lender                                                   |                                                              |                                                              |      |                                                              |
| Loan Limit                                               |                                                              |                                                              |      |                                                              |
| Loan  Balance                                            |                                                              |                                                              |      |                                                              |
| The Loan  Begins from (DD/MM/YYYY)                       |                                                              |                                                              |      |                                                              |
| Third Party  Info                                        | Solicitor                                                    | New  Purchase Agent                                          |      |                                                              |
| Name                                                     | -                                                            | -                                                            |      |                                                              |
| Address                                                  | -                                                            | -                                                            |      |                                                              |
| Landline                                                 | -                                                            | -                                                            |      |                                                              |
| Mobile                                                   | -                                                            | -                                                            |      |                                                              |
| Email Address                                            | -                                                            | -                                                            |      |                                                              |
| Loan Detail                                              |                                                              |                                                              |      |                                                              |
| Requirement  for new loan                                | Loan 1                                                       | Loan 2                                                       |      |                                                              |
| New Purchase  or Refinance                               | -                                                            | -                                                            |      |                                                              |
| Security  Address                                        | -                                                            | -                                                            |      |                                                              |
| Valuation  Report Value                                  | -                                                            | -                                                            |      |                                                              |
| Lender                                                   | -                                                            | -                                                            |      |                                                              |
| Loan amount                                              | -                                                            | -                                                            |      |                                                              |
| LVR                                                      | -                                                            | -                                                            |      |                                                              |
|                                                          |                                                              |                                                              |      |                                                              |
| ID                                                       | passport                                                     |                                                              |      |                                                              |
|                                                          | driver l                                                     |                                                              |      |                                                              |
|                                                          | visa pr                                                      |                                                              |      | SE:(不用问最近 3 年的 employment)                            |
|                                                          | 最近2 张工资单                                               |                                                              |      | 最近两年的financial report，company  tax return，individual tax return，NOA，找会计要的, |
|                                                          | 最近 3 个月的工资流水                                        |                                                              |      |                                                              |
|                                                          | ATO income statement                                         |                                                              |      |                                                              |
|                                                          | car loan statement if have                                   |                                                              |      |                                                              |
|                                                          | student loan statement if have                               | 一般在 ATO 上能看到                                          |      |                                                              |
|                                                          | mortgage loan  statement/summary(online banking or screenshot of app) if have |                                                              |      |                                                              |
|                                                          | council  rate(要转贷的房子的)/买房合同(买新房的需要买房合同 ) |                                                              |      |                                                              |
|                                                          | rental statement(中介给的)                                   |                                                              |      |                                                              |
|                                                          |                                                              |                                                              |      |                                                              |
|                                                          | 列出来不必填, 能 submit, 后续再找客人补可以                  |                                                              |      |                                                              |