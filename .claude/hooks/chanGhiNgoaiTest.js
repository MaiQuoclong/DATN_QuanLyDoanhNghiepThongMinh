// Hook PreToolUse: giới hạn quyền của sub-agent reviewer và qa-tester.
// Exit code 2 = chặn lệnh, nội dung stderr được gửi lại cho agent.
const path = require('path');

let duLieuVao = '';
process.stdin.on('data', (manh) => (duLieuVao += manh));
process.stdin.on('end', () => {
  let suKien;
  try {
    suKien = JSON.parse(duLieuVao);
  } catch {
    process.exit(0);
  }

  const tenAgent = suKien.agent_type;
  const tenCongCu = suKien.tool_name;
  const thamSo = suKien.tool_input || {};

  // Phiên chính (không phải sub-agent) không bị giới hạn bởi hook này
  if (!tenAgent) process.exit(0);

  const chan = (lyDo) => {
    process.stderr.write(lyDo);
    process.exit(2);
  };

  if (tenAgent === 'reviewer') {
    if (tenCongCu === 'Write' || tenCongCu === 'Edit' || tenCongCu === 'NotebookEdit') {
      chan('reviewer chỉ được đọc, không được sửa file.');
    }
    if (tenCongCu === 'Bash') {
      const lenh = (thamSo.command || '').trim();
      const hopLe = /^git (diff|log|status|show)\b[^;&|>]*$/.test(lenh);
      if (!hopLe) chan('reviewer chỉ được chạy git diff/log/status/show.');
    }
  }

  if (tenAgent === 'qa-tester') {
    if (tenCongCu === 'Write' || tenCongCu === 'Edit') {
      const duongDan = path
        .relative(suKien.cwd || process.cwd(), thamSo.file_path || '')
        .split(path.sep)
        .join('/');
      const hopLe =
        /^(backend|ai-service)\/tests\//.test(duongDan) ||
        /^frontend\/src\/.*\.test\.[jt]sx?$/.test(duongDan) ||
        duongDan === 'docs/progress.md';
      if (!hopLe) {
        chan(`qa-tester chỉ được ghi file test và docs/progress.md, bị chặn: ${duongDan}. Nếu phát hiện lỗi nghiệp vụ, hãy báo lại thay vì tự sửa.`);
      }
    }
    if (tenCongCu === 'Bash') {
      const lenh = (thamSo.command || '').trim();
      // Chặn nối lệnh/chuyển hướng (; & | > ` $() để không lách qua lệnh test
      const coNoiLenh = /[;&|>`]|\$\(/.test(lenh);
      const hopLe = !coNoiLenh && /^(npm test|npm run test|npx jest|pytest|python -m pytest|git (diff|status))\b/.test(lenh);
      if (!hopLe) chan('qa-tester chỉ được chạy lệnh test (npm test, npx jest, pytest).');
    }
  }

  process.exit(0);
});
