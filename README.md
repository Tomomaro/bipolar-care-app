# Bipolar Care App

双極症向けの体調ログアプリです。HTML/CSS/JavaScriptだけで動く静的サイトなので、Vercelにそのままデプロイできます。

## Files

- `index.html`
- `styles.css`
- `app.js`
- `vercel.json`
- `package.json`

## Local Check

```bash
npm run check
npm run dev
```

ブラウザで `http://localhost:8765` を開きます。

## Deploy To Vercel With GitHub

1. GitHubで新しいリポジトリを作成します。
2. この `bipolar-care-app` フォルダの中身をリポジトリにpushします。
3. Vercelにログインします。
4. `Add New...` -> `Project` を選びます。
5. GitHubリポジトリをImportします。
6. Framework Presetは `Other` を選びます。
7. Build Commandは空欄、Output Directoryも空欄または `.` にします。
8. Deployします。
9. 発行された `https://...vercel.app` のURLをiPhoneのSafariで開きます。

## iPhone Safari

公開URLをSafariで開いたあと、共有ボタンから「ホーム画面に追加」を選ぶとアプリのように起動できます。

## Notes

このアプリは現在、データをブラウザの `localStorage` に保存します。Vercelにデプロイしてもサーバーへ健康データは送信されません。端末を変えるとデータは引き継がれないため、将来の課金版では暗号化バックアップやアカウント同期を別途設計してください。
