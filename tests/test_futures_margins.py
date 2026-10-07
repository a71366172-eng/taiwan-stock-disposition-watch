import unittest

from jobs.collect_futures_margins import build_snapshot, parse_margin_rates


class FuturesMarginTests(unittest.TestCase):
    def test_parse_official_initial_margin_column(self):
        page = b'<tr><td headers="commodity_stock_id_a">2330</td><td headers="bond_rate3">20.25%</td></tr>'
        self.assertEqual(parse_margin_rates(page), {'2330': 20.25})

    def test_reject_incomplete_published_sources(self):
        with self.assertRaisesRegex(ValueError, 'incomplete'):
            build_snapshot(b'', [])


if __name__ == '__main__':
    unittest.main()
