import { AlertCircle, ArrowDown, ArrowUp, ExternalLink, Loader2, MapPin, Navigation, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import solidyLogo from './assets/Solidy_Vertical_Verde.png';

const API_URL = 'https://pay.xodo.vip/postos';
const MAX_DISTANCE_KM = 50;

const FUEL_COLUMNS = [
  { key: 'et', label: 'ET' },
  { key: 'gc', label: 'GC' },
  { key: 's10', label: 'S10' },
  { key: 's500', label: 'S500' },
];

const EXTRA_STATIONS = [
  {
    id: 44,
    name: 'POSTO SOLIDY BURITI',
    bandeira: 'Petrobras',
    lat: -16.741542,
    lng: -49.275273,
    et: '3,89',
    gc: '6,29',
    s10: null,
    s500: '6,99',
  },
  {
    id: 44,
    name: 'POSTO Solidy Padre Wendel',
    bandeira: 'Branca',
    lat: -16.6608202,
    lng: -49.3087529,
    et: '3,89',
    gc: '6,29',
    s10: '6,99',
    s500: null,
  },
];

function normalizeStation(station, source, index) {
  return {
    ...station,
    source,
    rowId: `${source}-${station.id}-${station.name}-${index}`,
    lat: Number(station.lat),
    lng: Number(station.lng),
  };
}

function parsePrice(value) {
  if (!value || value === '-') {
    return null;
  }

  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function formatPrice(value) {
  const price = parsePrice(value);

  if (price === null) {
    return '-';
  }

  return price.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getDistanceKm(from, to) {
  if (!from || !Number.isFinite(to.lat) || !Number.isFinite(to.lng)) {
    return null;
  }

  const earthRadiusKm = 6371;
  const degreesToRadians = (degrees) => (degrees * Math.PI) / 180;
  const latDelta = degreesToRadians(to.lat - from.lat);
  const lngDelta = degreesToRadians(to.lng - from.lng);
  const originLat = degreesToRadians(from.lat);
  const targetLat = degreesToRadians(to.lat);

  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(originLat) * Math.cos(targetLat) * Math.sin(lngDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function formatDistance(distanceKm) {
  if (distanceKm === null) {
    return '-';
  }

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }

  return `${distanceKm.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} km`;
}

function googleMapsUrl(station) {
  const query = encodeURIComponent(`${station.lat},${station.lng}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function SortIcon({ active, direction }) {
  if (!active) {
    return <span className="sort-placeholder">↕</span>;
  }

  return direction === 'asc' ? <ArrowUp size={15} /> : <ArrowDown size={15} />;
}

function BrandBadge({ brand }) {
  const normalized = String(brand || 'Branca').toLowerCase();
  const isPetrobras = normalized.includes('petrobras');
  const isShell = normalized.includes('shell');

  if (isPetrobras) {
    return <span className="brand-badge brand-badge--petrobras">BR</span>;
  }

  if (isShell) {
    return <span className="brand-badge brand-badge--shell">Shell</span>;
  }

  return <span className="brand-badge brand-badge--white">S</span>;
}

export default function App() {
  const [stations, setStations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('requesting');
  const [sort, setSort] = useState({ key: 'distance', direction: 'asc' });

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('unsupported');
      return;
    }

    setLocationStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationStatus('granted');
      },
      () => {
        setUserLocation(null);
        setLocationStatus('denied');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 300000,
        timeout: 10000,
      },
    );
  };

  const fetchStations = async () => {
    setIsLoading(true);
    setApiError('');

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ slug: 'solidy' }),
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}`);
      }

      const payload = await response.json();
      const apiStations = Array.isArray(payload?.data?.postos) ? payload.data.postos : [];
      const normalizedStations = [
        ...apiStations.map((station, index) => normalizeStation(station, 'api', index)),
        ...EXTRA_STATIONS.map((station, index) => normalizeStation(station, 'extra', index)),
      ];

      setStations(normalizedStations);
    } catch (error) {
      setStations(EXTRA_STATIONS.map((station, index) => normalizeStation(station, 'extra', index)));
      setApiError('Não foi possível carregar os postos agora.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    requestLocation();
    fetchStations();
  }, []);

  const stationsWithDistance = useMemo(
    () =>
      stations.map((station) => ({
        ...station,
        distanceKm: getDistanceKm(userLocation, station),
      })),
    [stations, userLocation],
  );

  const visibleStations = useMemo(() => {
    if (locationStatus !== 'granted') {
      return stationsWithDistance;
    }

    return stationsWithDistance.filter(
      (station) => station.distanceKm !== null && station.distanceKm <= MAX_DISTANCE_KM,
    );
  }, [locationStatus, stationsWithDistance]);

  const cheapestByFuel = useMemo(() => {
    return FUEL_COLUMNS.reduce((acc, fuel) => {
      const prices = visibleStations
        .map((station) => parsePrice(station[fuel.key]))
        .filter((price) => price !== null);

      acc[fuel.key] = prices.length ? Math.min(...prices) : null;
      return acc;
    }, {});
  }, [visibleStations]);

  const sortedStations = useMemo(() => {
    const directionMultiplier = sort.direction === 'asc' ? 1 : -1;

    return [...visibleStations].sort((a, b) => {
      let firstValue;
      let secondValue;

      if (sort.key === 'distance') {
        firstValue = a.distanceKm;
        secondValue = b.distanceKm;
      } else {
        firstValue = parsePrice(a[sort.key]);
        secondValue = parsePrice(b[sort.key]);
      }

      if (firstValue === null && secondValue === null) {
        return a.name.localeCompare(b.name, 'pt-BR');
      }

      if (firstValue === null) {
        return 1;
      }

      if (secondValue === null) {
        return -1;
      }

      return (firstValue - secondValue) * directionMultiplier;
    });
  }, [sort, visibleStations]);

  const handleSort = (key) => {
    setSort((currentSort) => {
      if (currentSort.key !== key) {
        return { key, direction: 'asc' };
      }

      return {
        key,
        direction: currentSort.direction === 'asc' ? 'desc' : 'asc',
      };
    });
  };

  const locationText = {
    requesting: 'Solicitando sua localização para ordenar pelos postos mais próximos.',
    granted: `Postos até ${MAX_DISTANCE_KM} km da sua localização.`,
    denied: 'Localização não autorizada. Você ainda pode consultar os preços.',
    unsupported: 'Este navegador não permite calcular a distância automaticamente.',
  }[locationStatus];

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="brand-panel">
          <img src={solidyLogo} alt="Solidy Benefícios" className="brand-logo" />
        </div>

        <div className="hero-copy">
          <span className="eyebrow">Rede credenciada</span>
          <h1>Postos disponíveis para abastecimento</h1>
          <p>Compare distância e preços de ET, GC, S10 e S500 nos postos Solidy próximos de você.</p>
        </div>
      </section>

      <section className="status-bar" aria-live="polite">
        <div className="status-item">
          <Navigation size={18} />
          <span>{locationText}</span>
        </div>

        {locationStatus !== 'granted' && (
          <button type="button" className="ghost-button" onClick={requestLocation}>
            <MapPin size={17} />
            Usar localização
          </button>
        )}
      </section>

      {apiError && (
        <section className="error-banner" role="alert">
          <AlertCircle size={19} />
          <span>{apiError}</span>
          <button type="button" onClick={fetchStations}>
            <RefreshCw size={16} />
            Tentar novamente
          </button>
        </section>
      )}

      <section className="table-section">
        <div className="table-heading">
          <div>
            <span className="section-kicker">Solidy</span>
            <h2>Postos</h2>
          </div>
          <div className="table-summary">
            <strong>{isLoading ? stations.length : visibleStations.length}</strong>
            <span>{locationStatus === 'granted' ? `postos até ${MAX_DISTANCE_KM} km` : 'postos encontrados'}</span>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="brand-column" aria-label="Bandeira"></th>
                <th className="name-column">Nome</th>
                <th>
                  <button type="button" className="sort-button" onClick={() => handleSort('distance')}>
                    Distância
                    <SortIcon active={sort.key === 'distance'} direction={sort.direction} />
                  </button>
                </th>
                {FUEL_COLUMNS.map((fuel) => (
                  <th key={fuel.key}>
                    <button type="button" className="sort-button" onClick={() => handleSort(fuel.key)}>
                      {fuel.label}
                      <SortIcon active={sort.key === fuel.key} direction={sort.direction} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 8 }).map((_, index) => (
                  <tr key={`loading-${index}`} className="loading-row">
                    <td>
                      <span className="skeleton skeleton-icon"></span>
                    </td>
                    <td>
                      <span className="skeleton skeleton-title"></span>
                    </td>
                    <td>
                      <span className="skeleton skeleton-small"></span>
                    </td>
                    {FUEL_COLUMNS.map((fuel) => (
                      <td key={fuel.key}>
                        <span className="skeleton skeleton-small"></span>
                      </td>
                    ))}
                  </tr>
                ))}

              {!isLoading &&
                sortedStations.map((station) => (
                  <tr key={station.rowId}>
                    <td>
                      <BrandBadge brand={station.bandeira} />
                    </td>
                    <td className="station-cell">
                      <a
                        href={googleMapsUrl(station)}
                        target="_blank"
                        rel="noreferrer"
                        className="station-link"
                        title={station.name}
                        data-full-name={station.name}
                      >
                        <MapPin size={20} />
                        <span className="station-name">{station.name}</span>
                        <ExternalLink size={15} className="external-icon" />
                      </a>
                      <span className="station-brand">{station.bandeira || 'Branca'}</span>
                    </td>
                    <td className="distance-cell">{formatDistance(station.distanceKm)}</td>
                    {FUEL_COLUMNS.map((fuel) => {
                      const price = parsePrice(station[fuel.key]);
                      const isBestPrice = price !== null && price === cheapestByFuel[fuel.key];

                      return (
                        <td key={fuel.key} className={isBestPrice ? 'price-cell price-cell--best' : 'price-cell'}>
                          {formatPrice(station[fuel.key])}
                        </td>
                      );
                    })}
                  </tr>
                ))}

              {!isLoading && sortedStations.length === 0 && (
                <tr>
                  <td className="empty-state" colSpan={FUEL_COLUMNS.length + 3}>
                    Nenhum posto encontrado em um raio de {MAX_DISTANCE_KM} km.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {isLoading && (
            <div className="loading-label">
              <Loader2 size={18} />
              Carregando postos
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
