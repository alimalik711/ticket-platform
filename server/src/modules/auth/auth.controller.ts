import type { RequestHandler } from "express";

const getCurrentUser: RequestHandler = (
  _request,
  response,
) => {
  response.status(200).json({
    status: "success",
    data: {
      user: response.locals.user,
    },
  });
};

export { getCurrentUser };