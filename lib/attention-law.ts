import type {MarketSnapshot,Stock} from './market-types';

// TWSE arts. 2–9: https://twse-regulation.twse.com.tw/m/LawContent.aspx?FID=FL007226
// TPEx arts. 2–9: https://www.selaw.com.tw/Chinese/RegulatoryInformationResult/Article?sysNumber=LW10819047
// These describe legal effects, not additional observed attention notices.
export type LegalEffect='不適用本款'|'免同類比較'|'免市場與同類比較'|'計算調整'|'須核對';
export type LegalDetail={effect:LegalEffect;text:string};
export const attentionLawUrl=(market:string)=>market==='TPEX'
 ?'https://www.selaw.com.tw/Chinese/RegulatoryInformationResult/Article?sysNumber=LW10819047'
 :'https://twse-regulation.twse.com.tw/m/LawContent.aspx?FID=FL007226';

export function clause2RecentFirstNoticeExcludes(stock:Stock,snapshot:Pick<MarketSnapshot,'calendar'|'asOf'>,sixDayReturn:number,longDirection:'up'|'down',marketSix:number,industrySix:number):boolean{
 const sessions=snapshot.calendar.filter(date=>date<=snapshot.asOf).slice(-29);
 if(!stock.notices.some(notice=>sessions.includes(notice.date)&&notice.rules.includes(1)))return false;
 const otc=stock.market==='TPEX',limit=otc?27:25,diffLimit=otc?15:20;
 const change=Math.abs(sixDayReturn);
 if(change<=limit)return true;
 if((sixDayReturn>=0?'up':'down')!==longDirection)return true;
 // TPEx waives market and sector comparisons for companies below NT$80m
 // paid-in capital, including the differential-based branch of this rule.
 if(otc&&stock.paidInCapital!==null&&stock.paidInCapital!==undefined&&stock.paidInCapital<80_000_000)return false;
 const marketDiff=sixDayReturn>=0?sixDayReturn-marketSix:marketSix-sixDayReturn;
 const industryDiff=sixDayReturn>=0?sixDayReturn-industrySix:industrySix-sixDayReturn;
 return marketDiff<diffLimit&&industryDiff<diffLimit;
}

/** Legal exceptions and calculation adjustments for the next-session forecast. */
export function attentionLegalDetails(stock:Stock,rule:number):LegalDetail[]{
 const otc=stock.market==='TPEX';
 const smallCap:LegalDetail[]=otc&&rule<=5?[{effect:'免市場與同類比較',text:`上櫃公司實收資本額未達 8,000 萬元，免全市場與同類比較${rule===3?'，且不適用第 3 款的 300 張排除門檻':rule===5?'及第 5 款的 300 張成交門檻':''}；其餘條件仍須符合。`}]:[];
 const shared:LegalDetail[]=[
  {effect:'計算調整',text:otc?'初次上櫃無漲跌幅限制期間不適用；除權息等非交易價格變動須排除後重算。目前缺上市日及完整企業行動資料，不能視為已核對。':'初次上市無漲跌幅限制期間的漲跌幅不納入計算；除權息等非交易價格變動須排除後重算。目前缺上市日及完整企業行動資料，不能視為已核對。'},
 ];
 const sector:LegalDetail[]=[
  {effect:'免同類比較',text:`同類證券未達 5 種，或本益比負值／達 ${otc?65:60} 倍，只免「同類」差幅比較；全市場差幅及其餘條件仍須符合。`},
 ];
 const premium:LegalDetail[]=[
  {effect:'不適用本款',text:'若適用溢折價規定，前一營業日溢折價未超過 10%，或溢折方向與本款漲跌方向相反，整款不適用；目前缺該官方欄位，尚未自動判定。'},
 ];
 const clause2Products:LegalDetail={effect:'不適用本款',text:'非分離型附認股權公司債、非分離型附認股權特別股、認購（售）權證與認股權憑證不適用；不能擴張成所有非普通股或 ETF 均排除。'};
 const volumeProducts:LegalDetail={effect:'不適用本款',text:`${otc?'轉換／交換公司債、股款繳納憑證、':'轉換公司債、'}附認股權公司債／特別股、債券換股權利證書、權證、ETF 與指數投資證券等法定商品不適用；一般普通股仍須判斷。`};
 switch(rule){
  case 1:return [...shared,{effect:'不適用本款',text:'普通股當日收盤價未滿 5 元，不適用第一款。'},...sector,...smallCap,...premium,{effect:'須核對',text:'權證另有無成交、當日零漲跌或方向相反的排除；本頁普通股不套用。'}];
  case 2:return [...shared,clause2Products,
   {effect:'不適用本款',text:`近 30 營業日曾公告第一款，且本次六日漲跌幅未超過 ${otc?27:25}%、「超過但與全市場及同類差幅均未達 ${otc?15:20} 個百分點」，或與本款長期漲跌方向相反，任一成立即排除第二款；可計算部分已從候選價格剔除。`},
   {effect:'不適用本款',text:'近 60 營業日最近一次處置「原因僅第二款」時，六日漲跌幅未超過 10%、超過但兩項差幅均未達 5 個百分點，或方向相反，任一成立即排除；處置原因仍須人工核對。'},...sector,...smallCap,...premium];
  case 3:return [...shared,volumeProducts,
   {effect:'不適用本款',text:`當日週轉率未達 ${otc?'1%':'0.1%'}，或成交量未達 ${otc?'300':'500'} 張，任一成立即排除；下個交易日的量尚未發生。${otc?'實收資本額未達 8,000 萬元者，法定成交量排除門檻不適用。':''}`},...sector,...smallCap,...premium];
  case 4:return [...shared,volumeProducts,...sector,...smallCap,...premium];
  case 5:return [...shared,
   {effect:'不適用本款',text:'法定排除的公司債與換股權利證書不適用；權證不是本款的通用豁免。'},...sector,...smallCap,...premium];
  case 6:return [
   {effect:'不適用本款',text:'第六款僅適用普通股；其他商品整款不適用。'},
   {effect:'計算調整',text:'初次上市／上櫃無漲跌幅限制期間的價格，不納入本款估值計算。'},
   ...(otc?[{effect:'免市場與同類比較' as const,text:'實收資本額未達 8,000 萬元的上櫃股票，免全市場與產業比較及一般成交量下限；券商／投資人集中金額門檻減半。'}]:[{effect:'計算調整' as const,text:'上市股票的週轉率及集中度計算，須扣除依鉅額證券買賣辦法成交的部分；目前缺鉅額逐筆資料。'}])];
  case 7:return [...shared,{effect:'不適用本款',text:'前一營業日券資比低於前二營業日券資比，整款不適用；目前缺足夠的逐日券資比，不能以當日餘額推斷。'},...sector,...premium];
  case 8:return [{effect:'不適用本款',text:'第八款只適用臺灣存託憑證；一般股票與 ETF 不適用。'},
   {effect:'計算調整',text:'存託憑證比較近六日最高／最低收盤時，須排除除權息等非交易因素。'}];
  default:return [];
 }
}
