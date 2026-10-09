import copy
import unittest
from jobs.collect_market import merge_disposition_history, validate_publication


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
