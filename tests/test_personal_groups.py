import unittest
from scripts.build_personal_groups import SOURCE, build


class PersonalGroupsTests(unittest.TestCase):
    def test_current_export_has_expected_boundaries(self):
        data = build(SOURCE.read_text(encoding="utf-8"))
        self.assertEqual(data["groups"][0]["name"], "矽光子（35族＆PA功率放大器）")
        self.assertEqual(data["groups"][-1]["codes"][-1], "6757")
        self.assertEqual(len(data["groups"]), 70)

    def test_new_group_and_stock_before_tiger_air_are_included(self):
        source = "矽光子:\n4903.TW\n新增族群:\n2330.TW\n6757.TW\n"
        data = build(source)
        self.assertEqual(data["groups"][1]["codes"], ["2330", "6757"])

    def test_extra_content_after_tiger_air_is_rejected(self):
        with self.assertRaises(ValueError):
            build("矽光子:\n4903.TW\n6757.TW\n商品ETF:\n0050.TW\n")


if __name__ == "__main__":
    unittest.main()
