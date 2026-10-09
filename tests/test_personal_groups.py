import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_personal_groups


class PersonalGroupBuilderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.personal = (ROOT / "data" / "personal-groups-source.txt").read_text(encoding="utf-8-sig")
        cls.fine_csv = (ROOT / "data" / "fine-industries.csv").read_text(encoding="utf-8-sig")
        cls.result = build_personal_groups.build(cls.personal, cls.fine_csv)

    def test_exports_both_user_group_sources(self):
        sources = self.result["sources"]
        self.assertEqual([source["id"] for source in sources], ["original", "fine_industry"])
        self.assertTrue(sources[0]["groups"])
        self.assertTrue(sources[1]["groups"])

    def test_original_export_keeps_its_expected_boundaries(self):
        groups = self.result["sources"][0]["groups"]
        self.assertEqual(groups[0]["name"], "矽光子（35族＆PA功率放大器）")
        self.assertEqual(groups[-1]["codes"][-1], "6757")
        self.assertEqual(len(groups), 70)

    def test_original_export_accepts_new_groups_before_tiger_air(self):
        groups = build_personal_groups.build_personal_groups("矽光子:\n4903.TW\n新增族群:\n2330.TW\n6757.TW\n")
        self.assertEqual(groups[1]["codes"], ["2330", "6757"])

    def test_original_export_rejects_content_after_tiger_air(self):
        with self.assertRaises(ValueError):
            build_personal_groups.build_personal_groups("矽光子:\n4903.TW\n6757.TW\n商品ETF:\n0050.TW\n")

    def test_fine_industry_csv_membership_is_preserved(self):
        groups = {group["name"]: group["codes"] for group in self.result["sources"][1]["groups"]}
        self.assertIn("PCB材料", groups)
        self.assertIn("2330", groups.get("晶圓代工", []))
        self.assertGreater(len(groups), 500)

    def test_rejects_duplicate_stock_codes(self):
        with self.assertRaisesRegex(ValueError, "股票代碼重複"):
            build_personal_groups.build_fine_industries(
                "代碼,商品,產業,所有細產業\n2330,台積電,上市半導體,晶圓代工\n2330,台積電,上市半導體,IC設計\n"
            )


if __name__ == "__main__":
    unittest.main()
