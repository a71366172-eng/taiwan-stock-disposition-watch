import unittest

from jobs.collect_futures_margins import build_snapshot, parse_etf_margins, parse_margin_rates


class FuturesMarginTests(unittest.TestCase):
    def test_parse_official_initial_margin_column(self):
        page = b'<tr><td headers="commodity_stock_id_a">2330</td><td headers="bond_rate3">20.25%</td></tr>'
        self.assertEqual(parse_margin_rates(page), {'2330': 20.25})

    def test_reject_incomplete_published_sources(self):
        with self.assertRaisesRegex(ValueError, 'incomplete'):
            build_snapshot(b'', [])

    def test_etf_original_margins_distinguish_standard_and_mini_contracts(self):
        page = ('<tr><td headers="commodity_stock_id_b">0050</td><td headers="bond_ch_name1_b">元大台灣50ETF期貨</td><td headers="bond_rate3_b">87,000</td></tr>'
                '<tr><td headers="commodity_stock_id_b">0050</td><td headers="bond_ch_name1_b">小型元大台灣50ETF期貨</td><td headers="bond_rate3_b">8,700</td></tr>').encode('utf-8')
        self.assertEqual(parse_etf_margins(page), {'0050': {'standard': {'initialMargin': 87000, 'shares': 10000}, 'mini': {'initialMargin': 8700, 'shares': 1000}}})


if __name__ == '__main__':
    unittest.main()
