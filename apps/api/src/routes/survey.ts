import { Router } from 'express';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { designSurveyResponses, designReviewComments } from '../db/schema.js';

export const surveyRouter = Router();

const surveySchema = z.object({
  preferredDirection: z.enum(['A', 'B', 'C']),
  ratingsEaseA: z.number().min(1).max(5).optional(),
  ratingsEaseB: z.number().min(1).max(5).optional(),
  ratingsEaseC: z.number().min(1).max(5).optional(),
  ratingsAppealA: z.number().min(1).max(5).optional(),
  ratingsAppealB: z.number().min(1).max(5).optional(),
  ratingsAppealC: z.number().min(1).max(5).optional(),
  likedMost: z.string().max(2000).optional(),
  concerns: z.string().max(2000).optional(),
  additionalFeedback: z.string().max(2000).optional(),
  detailedResponses: z.record(z.string(), z.string()).optional(),
  respondentName: z.string().max(255).optional(),
  respondentRole: z.string().max(100).optional(),
});

surveyRouter.post('/design-review', async (req, res) => {
  const parsed = surveySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid survey data', details: parsed.error.flatten() });
    return;
  }

  const result = await db.insert(designSurveyResponses).values(parsed.data).returning({ id: designSurveyResponses.id });
  res.status(201).json({ id: result[0].id, message: 'Survey response saved' });
});

const commentSchema = z.object({
  direction: z.string().max(30),
  stepNumber: z.number().int().min(0).max(20).optional(),
  comment: z.string().min(1).max(5000),
  reviewerName: z.string().max(255).optional(),
});

surveyRouter.post('/comments', async (req, res) => {
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid comment data', details: parsed.error.flatten() });
    return;
  }

  const result = await db.insert(designReviewComments).values(parsed.data).returning();
  res.status(201).json(result[0]);
});

surveyRouter.get('/comments/:direction', async (req, res) => {
  const { direction } = req.params;
  const comments = await db
    .select()
    .from(designReviewComments)
    .where(eq(designReviewComments.direction, direction))
    .orderBy(desc(designReviewComments.createdAt));
  res.json(comments);
});
