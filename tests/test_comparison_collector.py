import unittest
from jobs.collect_comparison import parse_quotes, quote_url


class ComparisonCollectorTests(unittest.TestCase):
    def test_twse_table_uses_named_close_column_and_excludes_funds(self):
        payload = {'tables': [{'fields': ['證券代號', '證券名稱', '成交股數', '收盤價'], 'data': [
            ['2330', '台積電', '1,000', '1,200.00'],
            ['0050', '元大台灣50', '100', '200'],
            ['123456', '權證', '100', '3'],
        ]}]}
        self.assertEqual(parse_quotes(payload), {'2330': ('台積電', 1200.0)})

    def test_tpex_table_and_json_rows_use_official_quote_fields(self):
        table = {'tables': [{'fields': ['代號', '名稱', '收盤'], 'data': [['8299', '群聯', '98.5']]}]}
        rows = [{'SecuritiesCompanyCode': '8299', 'CompanyName': '群聯', 'Close': '98.5'}]
        self.assertEqual(parse_quotes(table), {'8299': ('群聯', 98.5)})
        self.assertEqual(parse_quotes(rows), {'8299': ('群聯', 98.5)})
        self.assertIn('2026%2F10%2F02', quote_url('2026-10-02', 'TPEX'))


if __name__ == '__main__':
    unittest.main()
