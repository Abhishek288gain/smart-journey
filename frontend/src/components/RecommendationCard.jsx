import { useState } from 'react';
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, Stack, Typography } from '@mui/material';
import { AirplanemodeActive, DirectionsBus, DirectionsCar, Train, BookmarkBorder, Bookmark, Close, Schedule, Payments, Verified } from '@mui/icons-material';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const modeIcon = mode => mode==='flight'?<AirplanemodeActive/>:mode==='bus'?<DirectionsBus/>:mode==='cab'?<DirectionsCar/>:<Train/>;
const modeColor = mode => mode==='flight'?'#2196f3':mode==='bus'?'#ff9800':mode==='cab'?'#9c27b0':'#41d76c';

export default function RecommendationCard({ journey, rank, onSaved }) {
  const { user } = useAuth(); const navigate=useNavigate(); const [saved,setSaved]=useState(false); const [open,setOpen]=useState(false);
  const j=journey||{}; const price=Number(j.price||j.totalPrice||0); const duration=j.duration||j.totalDuration||'—'; const reliability=j.reliability ?? j.reliabilityScore ?? 90; const mode=(j.transportMode||j.mode||'train').toLowerCase();
  const save=async()=>{if(!user)return navigate('/login');try{await api.post('/trips',{journey:j._id,tripName:`${j.from||'Origin'} → ${j.to||'Destination'}`});setSaved(true);onSaved?.();}catch(e){alert(e.response?.data?.message||'Could not save trip')}};
  return <>
    <Box className={`recommend-card ${rank===0?'best-card':''}`}>
      <Box sx={{display:'flex',justifyContent:'space-between',gap:2,alignItems:'flex-start'}}>
        <Box sx={{display:'flex',gap:1.5,alignItems:'center'}}><Box className="mode-icon" sx={{background:`${modeColor(mode)}22`,color:modeColor(mode)}}>{modeIcon(mode)}</Box><Box><Stack direction="row" spacing={1} alignItems="center"><Chip size="small" label={rank===0?'BEST OVERALL':rank===1?'FASTEST':rank===2?'CHEAPEST':'BUDGET FRIENDLY'} color={rank===0?'success':'primary'}/>{rank===0&&<Typography variant="caption" color="success.main">✦ AI Recommended</Typography>}</Stack><Typography fontWeight={800} mt={.7}>{j.from||'Jabalpur'} <span className="muted-arrow">→</span> {j.to||'Mumbai'}</Typography><Typography variant="caption" color="text.secondary">{j.provider||'Smart Journey Partner'} · {(j.transportMode||'Train').toUpperCase()}</Typography></Box></Box>
        <IconButton onClick={save} color={saved?'success':'default'}>{saved?<Bookmark/>:<BookmarkBorder/>}</IconButton>
      </Box>
      <Divider sx={{my:1.5}}/>
      <Box className="metrics"><Box><Typography variant="h6" fontWeight={800}>{duration}</Typography><Typography variant="caption">Total Duration</Typography></Box><Box><Typography variant="h6" fontWeight={800}>₹ {price.toLocaleString()}</Typography><Typography variant="caption">Total Price</Typography></Box><Box><Typography variant="h6" fontWeight={800}>{reliability}%</Typography><Typography variant="caption">Reliability</Typography></Box><Button variant="outlined" onClick={()=>setOpen(true)}>View Details</Button></Box>
      {rank===0&&<Typography variant="caption" color="success.main">Save ₹{Math.max(0,Number((j.savings||570)))} · recommended balance of price, time & reliability</Typography>}
    </Box>
    <Dialog open={open} onClose={()=>setOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Journey Details <IconButton onClick={()=>setOpen(false)} sx={{float:'right'}}><Close/></IconButton></DialogTitle><DialogContent><Stack spacing={2}><Typography variant="h5" fontWeight={800}>{j.from} → {j.to}</Typography><Stack direction="row" spacing={1} flexWrap="wrap"><Chip icon={<Schedule/>} label={duration}/><Chip icon={<Payments/>} label={`₹ ${price.toLocaleString()}`}/><Chip icon={<Verified/>} label={`${reliability}% reliability`}/></Stack><Divider/><Typography>{j.description||'A smartly selected journey option based on your search preferences.'}</Typography></Stack></DialogContent><DialogActions><Button onClick={()=>setOpen(false)}>Close</Button><Button variant="contained" onClick={()=>navigate(`/journeys/${j._id}`)}>Continue</Button></DialogActions></Dialog>
  </>;
}
