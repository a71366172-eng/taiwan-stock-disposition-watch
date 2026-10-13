import copy
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
from jobs import collect_market
from jobs.collect_market import merge_disposition_history, merge_history_bars, twse_close_rows, validate_publication


class PublicationGuardTests(unittest.TestCase):
    def setUp(self):
        self.snapshot = {
            'asOf': '2026-10-02', 'ingestionErrors': [],
            'stocks': [{'code': '6538', 'market': 'TPEX', 'noticeHistoryComplete': True,
                        'bars': [{'date': f'2026-09-{i:02}', 'close': 100} for i in range(1, 31)],
                        'notices': [{'date': '2026-09-18'}]}],
            'dispositions': [{'code': '6538', 'announced': '2026-10-01', 'start': '2026-10-01', 'end': '2026-10-15'}],
        }

    def test_complete_snapshot_is_accepted(self):
        validate_publication(self.snapshot, copy.deepcopy(self.snapshot))

    def test_pending_price_row_does_not_erase_valid_history(self):
        previous = [{'date': f'2026-10-{day:02}', 'close': 100 + day} for day in range(1, 13)]
        incoming = [{'date': '2026-10-12', 'close': None}, {'date': '2026-10-13', 'close': None}]
        self.assertEqual(merge_history_bars(previous, incoming, '2026-10-13'), previous)
        completed = merge_history_bars(previous, [{'date': '2026-10-13', 'close': 113}], '2026-10-13')
        self.assertEqual(len(completed), 13)
        self.assertEqual(completed[-1]['close'], 113)

    def test_dated_twse_close_table_recovers_fresh_signed_quote(self):
        payload = {'stat': 'OK', 'date': '20261013', 'tables': [{
            'fields': ['證券代號', '證券名稱', '成交股數', '收盤價', '漲跌(+/-)', '漲跌價差'],
            'data': [['2330', '台積電', '40,796,261', '2,490.00', '<p>-</p>', '50.00']]}]}
        self.assertEqual(twse_close_rows(payload), [{
            'Date': '2026-10-13', 'Code': '2330', 'Name': '台積電',
            'ClosingPrice': 2490.0, 'Change': -50.0, 'TradeVolume': 40796261.0}])

    def test_failed_source_cannot_replace_good_snapshot(self):
        broken = copy.deepcopy(self.snapshot)
        broken['ingestionErrors'] = ['source timeout']
        with self.assertRaisesRegex(ValueError, 'source errors'):
            validate_publication(broken, self.snapshot)

    def test_missing_history_or_notice_or_disposition_is_rejected(self):
        for field in ['bars', 'notices', 'noticeHistoryComplete', 'dispositions']:
            with self.subTest(field=field):
                broken = copy.deepcopy(self.snapshot)
                if field == 'dispositions':
                    broken[field] = []
                else:
                    broken['stocks'][0][field] = False if field == 'noticeHistoryComplete' else []
                with self.assertRaises(ValueError):
                    validate_publication(broken, self.snapshot)

    def test_same_day_missing_stock_is_rejected(self):
        broken = copy.deepcopy(self.snapshot)
        broken['stocks'][0]['code'] = '2033'
        with self.assertRaisesRegex(ValueError, 'missing same-day stock'):
            validate_publication(broken, self.snapshot)

    def test_rolling_disposition_feed_keeps_previous_official_announcement(self):
        old=self.snapshot['dispositions'][0]
        current={**old,'code':'2455'}
        merged=merge_disposition_history([current],self.snapshot,self.snapshot['asOf'])
        codes={item['code'] for item in merged}
        self.assertTrue({'6538','2455'}<=codes)
        self.assertTrue(any(item['code']=='6538' and item['start']=='2026-09-11' for item in merged))
        self.assertTrue(any(item['code']=='6538' and item['start']=='2026-10-01' for item in merge_disposition_history([old],self.snapshot,self.snapshot['asOf'])))
        self.assertEqual(merge_disposition_history([],self.snapshot,'2027-03-01'),[])

    def test_same_day_refresh_preserves_old_dispositions_then_prunes_on_next_day(self):
        with TemporaryDirectory() as directory:
            root=Path(directory)
            (root/'data').mkdir()
            (root/'data'/'disposition-history.json').write_text(json.dumps({'records':[]}),encoding='utf-8')
            previous=copy.deepcopy(self.snapshot)
            previous['dispositions']=[{'code':'6830','announced':'2026-05-20','start':'2026-05-21','end':'2026-05-29'}]
            with patch.object(collect_market,'ROOT',root):
                same_day=merge_disposition_history([],previous,'2026-10-02')
                next_day=merge_disposition_history([],previous,'2026-10-03')
            self.assertEqual(len(same_day),1)
            self.assertEqual(next_day,[])
