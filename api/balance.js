// 라이브알파 실시간 잔고 — Vercel 서버리스 함수.
// 대시보드 페이지가 새로고침/주기 호출할 때마다 이 함수가 그 순간 Alpaca 페이퍼 계좌를
// 읽어 잔고+포지션을 돌려준다. 비밀키(ALPACA_*)는 Vercel 환경변수에만 — 브라우저 노출 0.
// 평소엔 안 돌고 누가 페이지 볼 때만 도니까 비용 0(서버리스, 온디맨드).
// 응답 스키마는 기존 balance.json 과 동일: equity / market_open / updated_epoch /
// n_positions / positions[](symbol,side,market_value,unrealized_pl,unrealized_plpc).

const ALPACA = "https://paper-api.alpaca.markets";
const ALLOW_ORIGIN = "https://o1chunsoo.github.io"; // 대시보드(GitHub Pages) 만 허용

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Cache-Control", "no-store"); // 항상 그 순간 값 — 캐시 금지

  const key = process.env.ALPACA_API_KEY_ID;
  const secret = process.env.ALPACA_API_SECRET_KEY;
  if (!key || !secret) {
    res.status(500).json({ error: "missing_keys" }); // Vercel env 미설정
    return;
  }
  const headers = { "APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret };

  try {
    const [acctR, posR, clockR] = await Promise.all([
      fetch(`${ALPACA}/v2/account`, { headers }),
      fetch(`${ALPACA}/v2/positions`, { headers }),
      fetch(`${ALPACA}/v2/clock`, { headers }),
    ]);
    if (!acctR.ok) {
      res.status(502).json({ error: "alpaca_account_failed", status: acctR.status });
      return;
    }
    const acct = await acctR.json();
    const pos = posR.ok ? await posR.json() : [];
    const clock = clockR.ok ? await clockR.json() : {};

    const positions = Array.isArray(pos)
      ? pos.map((p) => ({
          symbol: p.symbol,
          side: p.side,
          market_value: Number(p.market_value),
          unrealized_pl: Number(p.unrealized_pl),
          unrealized_plpc: Number(p.unrealized_plpc),
        }))
      : [];

    res.status(200).json({
      equity: Number(acct.equity),
      market_open: typeof clock.is_open === "boolean" ? clock.is_open : null,
      updated_epoch: Math.floor(Date.now() / 1000),
      n_positions: positions.length,
      positions,
    });
  } catch (e) {
    res.status(502).json({ error: "alpaca_unreachable" });
  }
}
