# Polymarket Trading Sim

real time trading sim for polymarket with fake money if too afraid to spend actual money and wanting to see if you COULD have made money if you actually had invested etc. 

prices live updated from polymarket (which as a sidenote seems to have a rll dumb api)

### Installation and running

1. clone repo
2. npm install
3. npm run dev
4. open http://localhost:3000

orders stored in local json file (data folder) so doesnt need to always be running for ur orders to save etc it just caches price data on reload etc
set with $10000 at start. u can change this line 19 app/page.tsx if u want 
