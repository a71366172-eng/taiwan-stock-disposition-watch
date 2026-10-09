import unittest
import json
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from jobs import collect_market
from jobs.collect_market import near_disposition_notice_codes, notice_rules, tpex_historical_notices


class TpexHistoricalNoticeTests(unittest.TestCase):
    def test_quote_fallback_tolerates_older_bars_without_reference(self):
        self.assertEqual(
            collect_market.fill_quote_from_bar({"close": 41.5, "volume": 12000}, None, None, None),
            (41.5, None, 12000),
        )

    def test_parses_official_table_rows_for_nonconsecutive_history(self):
        payload = {
            "tables": [{
                "fields": ["公告日期", "證券代號", "證券名稱", "注意交易資訊", "收盤價", "本益比"],
                "data": [
                    ["115/09/18", "6538", "倉和", "連續達公布注意交易資訊標準（第一款）", "360.00", "20.5"],
                    ["115/09/30", "6538", "倉和", "最近六個營業日達公布注意交易資訊標準（第一款）", "368.00", "21.0"],
                    ["115/10/01", "6538", "倉和", "最近六個營業日達公布注意交易資訊標準（第1款）", "370.00", "21.2"],
                    ["115/09/29", "3455", "由田", "其他股票注意資訊", "50.00", "10.0"],
                ],
            }]
        }

        notices = tpex_historical_notices(payload, "6538")

        self.assertEqual([notice["date"] for notice in notices], ["2026-09-18", "2026-09-30", "2026-10-01"])
        self.assertEqual([notice["code"] for notice in notices], ["6538", "6538", "6538"])
        self.assertEqual([notice["rules"] for notice in notices], [[1], [1], [1]])

    def test_empty_official_response_is_a_complete_empty_history(self):
        self.assertEqual(tpex_historical_notices({"tables": [{"fields": [], "data": []}]}, "6538"), [])

    def test_bulk_parser_keeps_security_codes_for_all_market_history(self):
        payload = {"tables": [{
            "fields": ["公告日期", "證券代號", "證券名稱", "注意交易資訊"],
            "data": [["115/10/01", "6538", "倉和", "第1款"], ["115/10/02", "3455", "由田", "第6款"]],
        }]}
        notices = tpex_historical_notices(payload)
        self.assertEqual([notice["code"] for notice in notices], ["6538", "3455"])

    def test_30_session_scan_includes_any_unique_day_for_only_clauses_one_to_eight(self):
        sessions = [f"2026-09-{day:02d}" for day in range(1, 31)]
        notices = [
            {"code": "1303", "date": date, "rules": [1, 6]}
            for date in sessions[:9]
        ]
        notices.extend([
            {"code": "9999", "date": date, "rules": [13]}
            for date in sessions[:20]
        ])
        notices.append({"code": "8888", "date": sessions[0], "rules": [2]})
        self.assertEqual(near_disposition_notice_codes(notices, sessions), {"1303", "8888"})

    def test_clause_parser_handles_full_width_digits_and_spacing(self):
        self.assertEqual(notice_rules("最近注意交易資訊（第 ６ 款及第 1 款）"), [1, 6])

    def test_tpex_history_posts_roc_dates_to_official_query(self):
        payload = {
            "stat": "ok",
            "tables": [{
                "fields": ["公告日期", "證券代號", "證券名稱", "注意交易資訊"],
                "data": [["115/09/18", "6538", "倉和", "第一款注意交易資訊"]],
            }],
        }
        with TemporaryDirectory() as temp_dir:
            with patch.object(collect_market, "RAW", Path(temp_dir)), patch.object(
                collect_market.urllib.request,
                "urlopen",
                return_value=BytesIO(json.dumps(payload).encode()),
            ) as urlopen:
                notices = collect_market.fetch_tpex_historical_notices("6538", "2026-06-19", "2026-10-02")

        request = urlopen.call_args.args[0]
        self.assertEqual(request.method, "POST")
        self.assertIn(b"startDate=115%2F06%2F19", request.data)
        self.assertIn(b"endDate=115%2F10%2F02", request.data)
        self.assertEqual([notice["date"] for notice in notices], ["2026-09-18"])


if __name__ == "__main__":
    unittest.main()
