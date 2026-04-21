/**
 * 统一 API 响应格式
 * { code: 0, data: {}, message: '' }
 */
function success(res, data = null, message = '操作成功') {
  res.json({
    code: 0,
    data,
    message
  });
}

function error(res, message = '操作失败', code = 1, statusCode = 400) {
  res.status(statusCode).json({
    code,
    data: null,
    message
  });
}

module.exports = { success, error };
