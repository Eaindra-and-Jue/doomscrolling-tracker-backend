/**
 * @openapi
 * /api/user-applications:
 *   get:
 *     tags: [User Applications]
 *     summary: List the authenticated user's applications
 *     description: Returns only application relationships owned by the user identified by the bearer token.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User applications returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [userApplications]
 *               properties:
 *                 userApplications:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UserApplication'
 *       401:
 *         description: Bearer token is missing or invalid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   post:
 *     tags: [User Applications]
 *     summary: Add an application to the authenticated user
 *     description: Creates a relationship using the user ID from the bearer token. Clients do not provide a user ID.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserApplicationRequest'
 *     responses:
 *       201:
 *         description: User application created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [userApplication]
 *               properties:
 *                 userApplication:
 *                   $ref: '#/components/schemas/UserApplication'
 *       400:
 *         description: applicationId is missing or is not a positive integer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Bearer token is missing or invalid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Application not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Application is already assigned to the user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/user-applications/{id}:
 *   put:
 *     tags: [User Applications]
 *     summary: Update an application relationship
 *     description: Changes an owned relationship to the requested application. Repeating an unchanged update succeeds.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: User-application relationship ID
 *         schema:
 *           type: integer
 *           minimum: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserApplicationRequest'
 *     responses:
 *       200:
 *         description: User application updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [userApplication]
 *               properties:
 *                 userApplication:
 *                   $ref: '#/components/schemas/UserApplication'
 *       400:
 *         description: Relationship ID or applicationId is not a positive integer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Bearer token is missing or invalid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Relationship is inaccessible or application does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Another relationship already uses the requested application
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   delete:
 *     tags: [User Applications]
 *     summary: Remove an application relationship
 *     description: Deletes a relationship owned by the user identified by the bearer token.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: User-application relationship ID
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       204:
 *         description: User application deleted successfully; response has no body
 *       400:
 *         description: Relationship ID is not a positive integer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Bearer token is missing or invalid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Relationship does not exist or is inaccessible to the user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

export {};
