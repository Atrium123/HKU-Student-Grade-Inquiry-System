const express = require('express');
const { z } = require('zod');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/api');

const router = express.Router();

const updateLocaleSchema = z.object({
  locale: z.enum(['zh-CN', 'en'])
});

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    sendSuccess(res, {
      status: 200,
      code: 'PROFILE_FETCHED',
      message: 'Profile loaded',
      data: {
        id: String(req.user._id),
        email: req.user.email,
        role: req.user.role,
        displayName: req.user.displayName,
        locale: req.user.locale,
        isActive: req.user.isActive,
        createdAt: req.user.createdAt
      }
    });
  })
);

router.patch(
  '/locale',
  requireAuth,
  validate(updateLocaleSchema),
  asyncHandler(async (req, res) => {
    req.user.locale = req.body.locale;
    await req.user.save();

    sendSuccess(res, {
      status: 200,
      code: 'PROFILE_UPDATED',
      message: 'Locale updated',
      data: {
        locale: req.user.locale
      }
    });
  })
);

module.exports = router;