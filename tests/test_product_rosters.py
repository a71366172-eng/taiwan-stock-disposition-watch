import datetime as dt
import unittest

from jobs.collect_market import parse_isin_convertibles, select_history_batch


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


if __name__ == '__main__':
    unittest.main()
