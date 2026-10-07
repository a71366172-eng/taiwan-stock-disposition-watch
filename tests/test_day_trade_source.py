import unittest
from unittest.mock import patch

from jobs import collect_market


class DayTradeSourceTests(unittest.TestCase):
    def test_empty_published_table_is_pending_without_blocking_snapshot(self):
        report = {'tables': [{'fields': ['證券代號', '當日沖銷交易成交股數'], 'data': []}]}
        with patch.object(collect_market, 'get', return_value=report):
            with patch.object(collect_market, 'public_source_url', return_value='official source'):
                before = len(collect_market.errors)
                self.assertIsNone(collect_market.day_trade_shares('2026-10-07', 'TPEX'))
                self.assertEqual(len(collect_market.errors), before)

    def test_missing_columns_still_fail_publication(self):
        report = {'tables': [{'fields': ['證券代號'], 'data': [['1234']]}]}
        with patch.object(collect_market, 'get', return_value=report):
            before = len(collect_market.errors)
            self.assertIsNone(collect_market.day_trade_shares('2026-10-07', 'TPEX'))
            self.assertEqual(len(collect_market.errors), before + 1)
            del collect_market.errors[before:]


if __name__ == '__main__':
    unittest.main()
