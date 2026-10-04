import copy
import unittest
from jobs.collect_market import validate_publication


class PublicationGuardTests(unittest.TestCase):
    def setUp(self):
        self.snapshot = {
            'asOf': '2026-10-02', 'ingestionErrors': [],
            'stocks': [{'code': '6538', 'market': 'TPEX', 'noticeHistoryComplete': True,
                        'bars': [{'date': f'2026-09-{i:02}', 'close': 100} for i in range(1, 31)],
                        'notices': [{'date': '2026-09-18'}]}],
            'dispositions': [{'code': '6538', 'start': '2026-10-01', 'end': '2026-10-15'}],
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
