import importlib.util
import pathlib
import unittest


MODULE = pathlib.Path(__file__).resolve().parents[1] / 'jobs' / 'collect_market.py'
spec = importlib.util.spec_from_file_location('collect_market', MODULE)
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)


class SourceRedactionTests(unittest.TestCase):
    def setUp(self):
        collector.sources.clear()

    def test_official_query_is_preserved_without_credentials(self):
        collector.record_source('https://www.twse.com.tw/exchangeReport/STOCK_DAY?date=20261001&stockNo=2330&api_key=private', 'now')
        self.assertEqual(collector.sources[0]['url'], 'https://www.twse.com.tw/exchangeReport/STOCK_DAY?date=20261001&stockNo=2330')

    def test_unapproved_or_embedded_credentials_are_not_published(self):
        collector.record_source('https://user:password@www.twse.com.tw/data', 'now')
        collector.record_source('https://example.com/data?token=private', 'now')
        self.assertEqual([source['url'] for source in collector.sources], ['來源端點未公開', '來源端點未公開'])
        self.assertEqual(collector.public_source_url('https://www.twse.com.tw:bad/data'), '來源端點未公開')


if __name__ == '__main__':
    unittest.main()
