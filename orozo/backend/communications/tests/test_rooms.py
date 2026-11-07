import unittest
from communications.services.room_service import RoomService


class TestRoomService(unittest.TestCase):
    def test_room_name_is_opaque_and_unique(self):
        name1 = RoomService.generate_room_name()
        name2 = RoomService.generate_room_name()

        self.assertTrue(name1.startswith("rm_orzo_"))
        self.assertTrue(name2.startswith("rm_orzo_"))
        self.assertNotEqual(name1, name2)
        # Verify sufficient entropy (at least 16 hex chars)
        self.assertGreaterEqual(len(name1), 20)

    def test_create_room_configuration_limits(self):
        room_name = RoomService.generate_room_name()
        config = RoomService.create_room(
            room_name=room_name,
            empty_timeout_seconds=300,
            max_participants=4,
        )

        self.assertEqual(config["name"], room_name)
        self.assertEqual(config["emptyTimeout"], 300)
        self.assertEqual(config["maxParticipants"], 4)
        self.assertEqual(config["status"], "created")

    def test_close_room(self):
        room_name = RoomService.generate_room_name()
        success = RoomService.close_room(room_name)
        self.assertTrue(success)


if __name__ == "__main__":
    unittest.main()
