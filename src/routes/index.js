const { Router } = require("express");

const router = Router();

router.get("/", (req, res) => res.send("Server is up and running"));

router.use(require("./users"));
router.use(require("./tasks"));
router.use(require("./submissions"));
router.use(require("./withdrawals"));
router.use(require("./payments"));
router.use(require("./stats"));

module.exports = router;
