import datetime as dt
import unittest

from jobs.collect_market import history_months_to_fetch, merge_history_bars, parse_isin_convertibles, parse_tpex_warrant_codes, parse_twse_candidates, select_history_batch, select_incomplete_warrant_history, tpex_company_rows_from_quotes


class TwseCandidateRosterTests(unittest.TestCase):
    def test_parses_official_openapi_candidate_fields(self):
        rows = [
            {'Code': '2033', 'Name': '佳大', 'RecentlyMetAttentionSecuritiesCriteria': '連續二次'},
            {'Code': '0050', 'Name': 'ETF', 'RecentlyMetAttentionSecuritiesCriteria': '不收普通股'},
        ]
        self.assertEqual(parse_twse_candidates(rows, lambda code: code == '2033'), {'2033': '連續二次'})

    def test_keeps_legacy_row_shape_for_cached_payloads(self):
        self.assertEqual(parse_twse_candidates([['', '2033', '佳大', '連續二次']], lambda code: True), {'2033': '連續二次'})


class ConvertibleBondRosterTests(unittest.TestCase):
    def test_parses_active_listed_and_otc_underlyings(self):
        html = '''<table><tr><td>轉換公司債</td></tr>
        <tr><td>11011 台泥一永</td><td>TW0001101105</td><td>2025/01/01</td><td>2028/01/01</td></tr>
        <tr><td>80691 元太一</td><td>TW0008069108</td><td>2024/01/01</td><td>2025/01/01</td></tr>
        <tr><td>公司債</td></tr><tr><td>B12345 公司債</td></tr></table>'''
        actual = parse_isin_convertibles(html, '2026-10-03', {'1101', '8069'})
        self.assertEqual(actual, {'1101'})

    def test_ignores_bonds_for_non_common_securities(self):
        html = '''<table><tr><td>轉換公司債</td></tr>
        <tr><td>00A01 ETF CB</td><td>ISIN</td><td>2025/01/01</td><td>2028/01/01</td></tr></table>'''
        self.assertEqual(parse_isin_convertibles(html, '2026-10-03', {'0050'}), set())


class HistoryBatchSelectionTests(unittest.TestCase):
    def test_complete_history_refresh_only_fetches_current_month(self):
        months = ['20261001', '20260901', '20260801', '20260701']
        old_bars = [{'date': f'2026-09-{day:02d}', 'close': 10} for day in range(1, 32)]
        self.assertEqual(history_months_to_fetch(old_bars, months, True), ['20261001'])

    def test_incomplete_history_backfills_three_months(self):
        months = ['20261001', '20260901', '20260801', '20260701']
        old_bars = [{'date': f'2026-09-{day:02d}', 'close': 10} for day in range(1, 20)]
        self.assertEqual(history_months_to_fetch(old_bars, months, True), months[:3])

    def test_history_merge_preserves_old_rows_and_prefers_fresh_corrections(self):
        old = [{'date': '2026-09-01', 'close': 10}, {'date': '2026-09-02', 'close': 11}]
        fresh = [{'date': '2026-09-02', 'close': 12}, {'date': '2026-10-01', 'close': 13}, {'date': '2026-10-02', 'close': 14}]
        self.assertEqual(merge_history_bars(old, fresh, '2026-10-01'), [
            {'date': '2026-09-01', 'close': 10}, {'date': '2026-09-02', 'close': 12}, {'date': '2026-10-01', 'close': 13},
        ])

    def test_manual_next_continues_after_last_published_batch(self):
        slots = [8, 12, 14, 18, 23]
        now = dt.datetime(2026, 10, 4, 7, 20)
        self.assertEqual(select_history_batch(slots, now, 'next', 1), 1)

    def test_manual_next_wraps_after_last_batch(self):
        self.assertEqual(select_history_batch([8, 12, 14, 18, 23], dt.datetime(2026, 10, 4, 7), 'next', 5), 0)

    def test_manual_batch_override_is_one_based_and_validated(self):
        slots = [8, 12, 14, 18, 23]
        now = dt.datetime(2026, 10, 4, 7, 20)
        self.assertEqual(select_history_batch(slots, now, '5', 1), 4)
        with self.assertRaises(ValueError):
            select_history_batch(slots, now, '6', 1)

    def test_scheduled_runs_continue_to_select_by_time_slot(self):
        slots = [8, 12, 14, 18, 23]
        self.assertEqual(select_history_batch(slots, dt.datetime(2026, 10, 4, 17, 45)), 3)

    def test_warrant_underlyings_with_incomplete_history_are_prioritized(self):
        old_bars = {
            'TWSE:1101': [{'close': 10}] * 30,
            'TWSE:1102': [{'close': 10}] * 31,
            'TWSE:1103': [{'close': 10}] * 3,
        }
        selected = select_incomplete_warrant_history({'1101', '1102', '1103', '8069'}, {'1101', '1102', '1103'}, old_bars, 'TWSE')
        self.assertEqual(selected, {'1101', '1103'})

    def test_warrant_history_backfill_obeys_per_run_limit(self):
        codes = {str(code) for code in range(1000, 1200)}
        selected = select_incomplete_warrant_history(codes, codes, {}, 'TWSE', limit=75)
        self.assertEqual(len(selected), 75)
        self.assertEqual(selected, set(sorted(codes)[:75]))

    def test_tpex_warrant_roster_uses_active_underlying_common_stocks(self):
        rows = [
            {'UnderlyingStockCode': '8069', 'ExpiryDate': '20261231', 'ListedDate': '20260101'},
            {'UnderlyingStockCode': '8069', 'ExpiryDate': '20260930', 'ListedDate': '20260101'},
            {'UnderlyingStockCode': '9999', 'ExpiryDate': '20261231', 'ListedDate': '20260101'},
            {'UnderlyingStockCode': '8299', 'ExpiryDate': '20261231', 'ListedDate': '20261005'},
        ]
        actual = parse_tpex_warrant_codes(rows, '2026-10-02', {'8069', '8299'})
        self.assertEqual(actual, {'8069'})

    def test_tpex_quote_roster_fallback_keeps_common_stocks_and_prior_metadata(self):
        quotes = [
            {'SecuritiesCompanyCode': '8069', 'CompanyName': '元太'},
            {'SecuritiesCompanyCode': '00679B', 'CompanyName': 'ETF'},
        ]
        old = [{'code': '8069', 'market': 'TPEX', 'name': '舊名', 'industry': '其他', 'issuedShares': 12345}]
        self.assertEqual(tpex_company_rows_from_quotes(quotes, old), [{
            '公司代號': '8069', '公司簡稱': '元太', '產業別': '其他',
            '已發行普通股數或TDR原股發行股數': 12345,
        }])


if __name__ == '__main__':
    unittest.main()
