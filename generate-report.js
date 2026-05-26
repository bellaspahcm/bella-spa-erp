const fs = require('fs');

try {
  const data = JSON.parse(fs.readFileSync('./test-results.json', 'utf8'));

  const numPassedTests = data.numPassedTests;
  const numFailedTests = data.numFailedTests;
  const numTotalTests = data.numTotalTests;
  const numPendingTests = data.numPendingTests;
  
  let html = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Báo cáo Kết quả Kiểm thử Toàn diện - Bella Spa ERP</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f8fafc;
        }
        .gradient-text {
            background: linear-gradient(to right, #be185d, #e11d48);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
    </style>
</head>
<body class="text-slate-800 p-8">
    <div class="max-w-7xl mx-auto">
        <header class="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-8 flex items-center justify-between">
            <div>
                <h1 class="text-3xl font-extrabold gradient-text mb-2">Bella Spa ERP</h1>
                <h2 class="text-xl font-bold text-slate-700">Báo cáo Kiểm thử Tự động Toàn diện</h2>
                <p class="text-slate-500 mt-2 text-sm">Tổng hợp kết quả của tất cả các bài test trong hệ thống.</p>
            </div>
            <div class="text-right">
                <div class="${numFailedTests === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'} font-bold px-4 py-2 rounded-lg border inline-block mb-2">
                    Trạng thái: ${numFailedTests === 0 ? '100% PASSED' : 'FAILED'}
                </div>
                <p class="text-slate-500 text-sm">Ngày tạo: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>
                <p class="text-slate-500 text-sm">Môi trường: E2E Testing (Mock DB)</p>
            </div>
        </header>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <span class="text-slate-500 text-sm font-semibold mb-1 uppercase tracking-wider">Tổng kịch bản</span>
                <span class="text-3xl font-black text-slate-800">${numTotalTests}</span>
            </div>
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center border-l-4 border-l-emerald-500">
                <span class="text-slate-500 text-sm font-semibold mb-1 uppercase tracking-wider">Thành công (Passed)</span>
                <span class="text-3xl font-black text-emerald-600">${numPassedTests}</span>
            </div>
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center border-l-4 border-l-rose-500">
                <span class="text-slate-500 text-sm font-semibold mb-1 uppercase tracking-wider">Thất bại (Failed)</span>
                <span class="text-3xl font-black text-rose-600">${numFailedTests}</span>
            </div>
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center border-l-4 border-l-amber-500">
                <span class="text-slate-500 text-sm font-semibold mb-1 uppercase tracking-wider">Bỏ qua (Skipped/Pending)</span>
                <span class="text-3xl font-black text-amber-600">${numPendingTests}</span>
            </div>
        </div>
        
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div class="px-8 py-5 border-b border-slate-200 bg-slate-50">
                <h3 class="text-lg font-bold text-slate-800">Chi tiết tất cả bài kiểm thử</h3>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                            <th class="px-6 py-4 font-bold">Suite (File)</th>
                            <th class="px-6 py-4 font-bold">Nhóm (Describe)</th>
                            <th class="px-6 py-4 font-bold">Kịch bản (Test Case)</th>
                            <th class="px-6 py-4 font-bold text-center">Trạng thái</th>
                            <th class="px-6 py-4 font-bold text-center">Thời gian</th>
                        </tr>
                    </thead>
                    <tbody class="text-sm divide-y divide-slate-100">
  `;

  let testIndex = 0;
  data.testResults.forEach(suite => {
    const filename = suite.name.split(/[\\\\/]/).pop();
    
    suite.assertionResults.forEach(test => {
      testIndex++;
      const isPassed = test.status === 'passed';
      const isFailed = test.status === 'failed';
      const statusBadge = isPassed 
        ? '<span class="bg-emerald-100 text-emerald-700 font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-wider">Pass</span>'
        : (isFailed ? '<span class="bg-rose-100 text-rose-700 font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-wider">Fail</span>' 
        : '<span class="bg-amber-100 text-amber-700 font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-wider">Skip</span>');

      const describeBlock = test.ancestorTitles.join(' > ');
      const title = test.title;
      const duration = test.duration ? test.duration + ' ms' : '-';

      html += `
                        <tr class="hover:bg-slate-50 transition-colors">
                            <td class="px-6 py-3 text-slate-500 text-xs font-mono truncate max-w-[200px]" title="${filename}">${filename}</td>
                            <td class="px-6 py-3 font-semibold text-slate-600 text-xs">${describeBlock}</td>
                            <td class="px-6 py-3 text-slate-800 text-sm">${title}</td>
                            <td class="px-6 py-3 text-center">${statusBadge}</td>
                            <td class="px-6 py-3 text-center text-slate-500 text-xs">${duration}</td>
                        </tr>
      `;
    });
  });

  html += `
                    </tbody>
                </table>
            </div>
        </div>

        <div class="mt-8 text-center text-slate-500 text-xs">
            &copy; 2026 Bella Spa ERP System. AI Generated Report.
        </div>
    </div>
</body>
</html>
  `;

  fs.writeFileSync('./test-report-full.html', html);
  console.log('Successfully generated test-report-full.html');
} catch (e) {
  console.error('Error:', e);
}
