import { Router, Response } from 'express'
import { execSync } from 'child_process'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authenticate)

const SUPER_ONLY = ['SUPER_ADMIN']

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!SUPER_ONLY.includes(req.user!.role)) {
    res.status(403).json({ error: 'Super Admin only' }); return
  }
  try {
    // Memory
    const freeOut = execSync('free -b').toString()
    const memLine = freeOut.split('\n')[1].trim().split(/\s+/)
    const memTotal = parseInt(memLine[1])
    const memUsed = parseInt(memLine[2])
    const memFree = parseInt(memLine[3])

    // Disk
    const dfOut = execSync("df -B1 /").toString()
    const dfLine = dfOut.split('\n')[1].trim().split(/\s+/)
    const diskTotal = parseInt(dfLine[1])
    const diskUsed = parseInt(dfLine[2])
    const diskAvail = parseInt(dfLine[3])

    // Uptime
    const uptimeOut = execSync('uptime -p').toString().trim()
    const loadOut = execSync('cat /proc/loadavg').toString().trim().split(' ')
    const load1 = parseFloat(loadOut[0])
    const load5 = parseFloat(loadOut[1])
    const load15 = parseFloat(loadOut[2])

    // PM2 processes
    const pm2Out = execSync('pm2 jlist').toString()
    const pm2List = JSON.parse(pm2Out)
    const processes = pm2List.map((p: Record<string, unknown>) => {
      const pm2Env = p.pm2_env as Record<string, unknown>
      const monit = p.monit as Record<string, unknown>
      return {
        id: p.pm_id,
        name: p.name,
        status: pm2Env?.status || 'unknown',
        cpu: monit?.cpu ?? 0,
        memory: monit?.memory ?? 0,
        restarts: pm2Env?.restart_time ?? 0,
        uptime: pm2Env?.pm_uptime ?? null,
      }
    })

    // Nginx status
    let nginxStatus = 'unknown'
    try {
      execSync('systemctl is-active nginx', { stdio: 'pipe' })
      nginxStatus = 'active'
    } catch { nginxStatus = 'inactive' }

    // Docker status
    let dockerStatus = 'unknown'
    try {
      execSync('systemctl is-active docker', { stdio: 'pipe' })
      dockerStatus = 'active'
    } catch { dockerStatus = 'inactive' }

    // Postgres container
    let postgresStatus = 'unknown'
    try {
      const containers = execSync('docker ps --format "{{.Names}}:{{.Status}}"').toString()
      const pgLine = containers.split('\n').find(l => l.includes('procura-postgres'))
      postgresStatus = pgLine ? (pgLine.includes('Up') ? 'running' : 'stopped') : 'not found'
    } catch { postgresStatus = 'error' }

    res.json({
      timestamp: new Date().toISOString(),
      uptime: uptimeOut,
      load: { load1, load5, load15 },
      memory: { total: memTotal, used: memUsed, free: memFree },
      disk: { total: diskTotal, used: diskUsed, available: diskAvail },
      processes,
      services: {
        nginx: nginxStatus,
        docker: dockerStatus,
        postgres: postgresStatus,
      },
    })
  } catch (e) {
    console.error('health error:', e)
    res.status(500).json({ error: 'Failed to get health data' })
  }
})

export default router
